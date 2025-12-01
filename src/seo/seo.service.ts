import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { LazyLoadingSettingsDto, SectionLazyLoadingDto } from './dto/lazy-loading.dto';
import { CreateGlobalSeoDto } from './dto/create-global-seo.dto';
import { UpdateGlobalSeoDto } from './dto/update-global-seo.dto';
import { CreatePageSeoDto } from './dto/create-page-seo.dto';
import { UpdatePageSeoDto } from './dto/update-page-seo.dto';

@Injectable()
export class SeoService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(
    private configService: ConfigService,
    private prisma: DatabaseService,
  ) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || 'eastland-s3';

    // Security: AWS credentials stored in environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // Never hardcoded in source code - ensures secrets are not committed to version control
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  private getQualityFromCompressionLevel(compressionLevel: string): number {
    const qualityMap = {
      low: 85,
      medium: 75,
      high: 65,
      maximum: 50,
    };
    return qualityMap[compressionLevel] || 75;
  }

  async optimizeImage(
    file: Express.Multer.File,
    compressionLevel: string = 'medium',
    format: string = 'webp',
  ): Promise<{
    url: string;
    originalSize: number;
    optimizedSize: number;
    format: string;
    width: number;
    height: number;
    message: string;
  }> {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only images are allowed.');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit.');
    }

    const originalSize = file.size;
    const quality = this.getQualityFromCompressionLevel(compressionLevel);
    const outputFormat = format.toLowerCase();

    try {
      // Process image with Sharp
      let processedImage: Buffer;
      let metadata: sharp.Metadata;

      const sharpInstance = sharp(file.buffer);

      // Convert format and compress based on output format
      switch (outputFormat) {
        case 'webp':
          processedImage = await sharpInstance.webp({ quality }).toBuffer();
          metadata = await sharp(processedImage).metadata();
          break;
        case 'jpeg':
        case 'jpg':
          processedImage = await sharpInstance
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
          metadata = await sharp(processedImage).metadata();
          break;
        case 'png':
          processedImage = await sharpInstance
            .png({ quality, compressionLevel: 9 })
            .toBuffer();
          metadata = await sharp(processedImage).metadata();
          break;
        case 'avif':
          processedImage = await sharpInstance.avif({ quality }).toBuffer();
          metadata = await sharp(processedImage).metadata();
          break;
        default:
          // Default to webp
          processedImage = await sharpInstance.webp({ quality }).toBuffer();
          metadata = await sharp(processedImage).metadata();
      }

      // Generate unique filename
      const fileExtension = outputFormat === 'jpg' ? 'jpeg' : outputFormat;
      const fileName = `optimized/${uuidv4()}.${fileExtension}`;

      // Upload to S3
      const uploadParams: any = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: processedImage,
        ContentType: `image/${fileExtension}`,
        ACL: 'public-read',
      };

      const upload = new Upload({
        client: this.s3Client,
        params: uploadParams,
      });

      await upload.done();

      // Return the public URL
      const publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileName}`;

      return {
        url: publicUrl,
        originalSize,
        optimizedSize: processedImage.length,
        format: fileExtension,
        width: metadata.width || 0,
        height: metadata.height || 0,
        message: 'Image optimized successfully',
      };
    } catch (error) {
      console.error('Error optimizing image:', error);
      throw new BadRequestException(
        error.message || 'Failed to optimize image',
      );
    }
  }

  // Lazy Loading Methods

  async getLazyLoadingSettings() {
    const settings = await this.prisma.seoLazyLoadingSettings.findFirst();

    if (!settings) {
      throw new NotFoundException('Lazy loading settings not found');
    }

    return {
      enabled: settings.enabled,
      whereToApply: settings.whereToApply,
      metaKeywords: settings.metaKeywords || '',
      preloadThreshold: settings.preloadThreshold || '',
      loadingAttribute: settings.loadingAttribute,
    };
  }

  async saveLazyLoadingSettings(dto: LazyLoadingSettingsDto) {
    // Check if settings exist
    const existing = await this.prisma.seoLazyLoadingSettings.findFirst();

    let result;
    if (existing) {
      // Update existing
      result = await this.prisma.seoLazyLoadingSettings.update({
        where: { id: existing.id },
        data: {
          enabled: dto.enabled,
          whereToApply: dto.whereToApply,
          metaKeywords: dto.metaKeywords || null,
          preloadThreshold: dto.preloadThreshold || null,
          loadingAttribute: dto.loadingAttribute,
        },
      });
    } else {
      // Create new
      result = await this.prisma.seoLazyLoadingSettings.create({
        data: {
          enabled: dto.enabled,
          whereToApply: dto.whereToApply,
          metaKeywords: dto.metaKeywords || null,
          preloadThreshold: dto.preloadThreshold || null,
          loadingAttribute: dto.loadingAttribute,
        },
      });
    }

    return {
      id: result.id,
      enabled: result.enabled,
      whereToApply: result.whereToApply,
      metaKeywords: result.metaKeywords,
      preloadThreshold: result.preloadThreshold,
      loadingAttribute: result.loadingAttribute,
      updatedAt: result.updatedAt,
    };
  }

  async getSectionLazyLoadingConfigs() {
    const configs = await this.prisma.seoSectionLazyLoading.findMany({
      select: {
        sectionId: true,
        enabled: true,
        loadingAttribute: true,
        preloadThreshold: true,
      },
    });

    return configs.map((config) => ({
      sectionId: config.sectionId,
      enabled: config.enabled,
      loadingAttribute: config.loadingAttribute,
      preloadThreshold: config.preloadThreshold || undefined,
    }));
  }

  async saveSectionLazyLoadingConfigs(dto: SectionLazyLoadingDto) {
    const savedSections: Array<{
      id: number;
      sectionId: number;
      enabled: boolean;
      loadingAttribute: string;
      preloadThreshold: string | null;
      updatedAt: Date;
    }> = [];

    // Use transaction for atomicity
    await this.prisma.$transaction(async (tx) => {
      const txClient = tx as any; // Type assertion for Prisma 7 transaction client
      
      for (const section of dto.sections) {
        // Validate section exists
        const sectionExists = await txClient.section.findUnique({
          where: { id: section.sectionId },
        });

        if (!sectionExists) {
          throw new BadRequestException(
            `Section with ID ${section.sectionId} does not exist`,
          );
        }

        // Upsert section config
        const result = await txClient.seoSectionLazyLoading.upsert({
          where: { sectionId: section.sectionId },
          update: {
            enabled: section.enabled,
            loadingAttribute: section.loadingAttribute,
            preloadThreshold: section.preloadThreshold || null,
          },
          create: {
            sectionId: section.sectionId,
            enabled: section.enabled,
            loadingAttribute: section.loadingAttribute,
            preloadThreshold: section.preloadThreshold || null,
          },
        });

        savedSections.push({
          id: result.id,
          sectionId: result.sectionId,
          enabled: result.enabled,
          loadingAttribute: result.loadingAttribute,
          preloadThreshold: result.preloadThreshold,
          updatedAt: result.updatedAt,
        });
      }
    });

    return {
      count: savedSections.length,
      sections: savedSections,
    };
  }

  // Global SEO Methods

  async getGlobalSeo() {
    const globalSeo = await this.prisma.globalSeo.findFirst();

    if (!globalSeo) {
      throw new NotFoundException('Global SEO settings not found');
    }

    return {
      siteName: globalSeo.siteName,
      defaultTitle: globalSeo.defaultTitle,
      defaultDescription: globalSeo.defaultDescription,
      defaultKeywords: globalSeo.defaultKeywords,
      googleSiteVerification: globalSeo.googleSiteVerification || undefined,
      bingSiteVerification: globalSeo.bingSiteVerification || undefined,
      robotsTxt: globalSeo.robotsTxt || undefined,
    };
  }

  async createOrUpdateGlobalSeo(dto: CreateGlobalSeoDto) {
    // Check if settings exist
    const existing = await this.prisma.globalSeo.findFirst();

    let result;
    if (existing) {
      // Update existing
      result = await this.prisma.globalSeo.update({
        where: { id: existing.id },
        data: {
          siteName: dto.siteName,
          defaultTitle: dto.defaultTitle,
          defaultDescription: dto.defaultDescription,
          defaultKeywords: dto.defaultKeywords,
          googleSiteVerification: dto.googleSiteVerification || null,
          bingSiteVerification: dto.bingSiteVerification || null,
          robotsTxt: dto.robotsTxt || null,
        },
      });
    } else {
      // Create new
      result = await this.prisma.globalSeo.create({
        data: {
          siteName: dto.siteName,
          defaultTitle: dto.defaultTitle,
          defaultDescription: dto.defaultDescription,
          defaultKeywords: dto.defaultKeywords,
          googleSiteVerification: dto.googleSiteVerification || null,
          bingSiteVerification: dto.bingSiteVerification || null,
          robotsTxt: dto.robotsTxt || null,
        },
      });
    }

    return {
      siteName: result.siteName,
      defaultTitle: result.defaultTitle,
      defaultDescription: result.defaultDescription,
      defaultKeywords: result.defaultKeywords,
      googleSiteVerification: result.googleSiteVerification || undefined,
      bingSiteVerification: result.bingSiteVerification || undefined,
      robotsTxt: result.robotsTxt || undefined,
    };
  }

  async updateGlobalSeo(dto: UpdateGlobalSeoDto) {
    const existing = await this.prisma.globalSeo.findFirst();

    if (!existing) {
      throw new NotFoundException('Global SEO settings not found');
    }

    const result = await this.prisma.globalSeo.update({
      where: { id: existing.id },
      data: {
        ...(dto.siteName !== undefined && { siteName: dto.siteName }),
        ...(dto.defaultTitle !== undefined && { defaultTitle: dto.defaultTitle }),
        ...(dto.defaultDescription !== undefined && {
          defaultDescription: dto.defaultDescription,
        }),
        ...(dto.defaultKeywords !== undefined && {
          defaultKeywords: dto.defaultKeywords,
        }),
        ...(dto.googleSiteVerification !== undefined && {
          googleSiteVerification: dto.googleSiteVerification || null,
        }),
        ...(dto.bingSiteVerification !== undefined && {
          bingSiteVerification: dto.bingSiteVerification || null,
        }),
        ...(dto.robotsTxt !== undefined && { robotsTxt: dto.robotsTxt || null }),
      },
    });

    return {
      siteName: result.siteName,
      defaultTitle: result.defaultTitle,
      defaultDescription: result.defaultDescription,
      defaultKeywords: result.defaultKeywords,
      googleSiteVerification: result.googleSiteVerification || undefined,
      bingSiteVerification: result.bingSiteVerification || undefined,
      robotsTxt: result.robotsTxt || undefined,
    };
  }

  // Page SEO Methods

  async getPageSeo(pageId: number) {
    // First verify page exists
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const pageSeo = await this.prisma.pageSeo.findUnique({
      where: { pageId },
    });

    if (!pageSeo) {
      throw new NotFoundException('Page SEO settings not found');
    }

    return {
      pageId: pageSeo.pageId,
      metaTitle: pageSeo.metaTitle,
      metaDescription: pageSeo.metaDescription,
      metaKeywords: pageSeo.metaKeywords || undefined,
      canonicalUrl: pageSeo.canonicalUrl || undefined,
      robots: pageSeo.robots,
      structuredData: pageSeo.structuredData || undefined,
    };
  }

  async getPageSeoBySlug(slug: string) {
    // First verify page exists by slug
    const page = await this.prisma.page.findUnique({
      where: { slug },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const pageSeo = await this.prisma.pageSeo.findUnique({
      where: { pageId: page.id },
    });

    if (!pageSeo) {
      throw new NotFoundException('Page SEO settings not found');
    }

    return {
      pageId: pageSeo.pageId,
      metaTitle: pageSeo.metaTitle,
      metaDescription: pageSeo.metaDescription,
      metaKeywords: pageSeo.metaKeywords || undefined,
      canonicalUrl: pageSeo.canonicalUrl || undefined,
      robots: pageSeo.robots,
      structuredData: pageSeo.structuredData || undefined,
    };
  }

  async createPageSeo(dto: CreatePageSeoDto) {
    // Verify page exists
    const page = await this.prisma.page.findUnique({
      where: { id: dto.pageId },
    });

    if (!page) {
      throw new BadRequestException(`Page with ID ${dto.pageId} does not exist`);
    }

    // Check if SEO settings already exist
    const existing = await this.prisma.pageSeo.findUnique({
      where: { pageId: dto.pageId },
    });

    if (existing) {
      throw new ConflictException(
        'SEO settings already exist for this page. Use PATCH to update.',
      );
    }

    const result = await this.prisma.pageSeo.create({
      data: {
        pageId: dto.pageId,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        metaKeywords: dto.metaKeywords || null,
        canonicalUrl: dto.canonicalUrl || null,
        robots: dto.robots || 'index, follow',
        structuredData: dto.structuredData || undefined,
      },
    });

    return {
      pageId: result.pageId,
      metaTitle: result.metaTitle,
      metaDescription: result.metaDescription,
      metaKeywords: result.metaKeywords || undefined,
      canonicalUrl: result.canonicalUrl || undefined,
      robots: result.robots,
      structuredData: result.structuredData || undefined,
    };
  }

  async updatePageSeo(pageId: number, dto: UpdatePageSeoDto) {
    // Verify page exists
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Check if SEO settings exist
    const existing = await this.prisma.pageSeo.findUnique({
      where: { pageId },
    });

    if (!existing) {
      throw new NotFoundException('Page SEO settings not found');
    }

    const result = await this.prisma.pageSeo.update({
      where: { pageId },
      data: {
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && {
          metaDescription: dto.metaDescription,
        }),
        ...(dto.metaKeywords !== undefined && {
          metaKeywords: dto.metaKeywords || null,
        }),
        ...(dto.canonicalUrl !== undefined && {
          canonicalUrl: dto.canonicalUrl || null,
        }),
        ...(dto.robots !== undefined && { robots: dto.robots }),
        ...(dto.structuredData !== undefined && {
          structuredData: dto.structuredData || undefined,
        }),
      },
    });

    return {
      pageId: result.pageId,
      metaTitle: result.metaTitle,
      metaDescription: result.metaDescription,
      metaKeywords: result.metaKeywords || undefined,
      canonicalUrl: result.canonicalUrl || undefined,
      robots: result.robots,
      structuredData: result.structuredData || undefined,
    };
  }
}

