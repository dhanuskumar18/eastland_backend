import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { LazyLoadingSettingsDto, SectionLazyLoadingDto } from './dto/lazy-loading.dto';

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
      for (const section of dto.sections) {
        // Validate section exists
        const sectionExists = await tx.section.findUnique({
          where: { id: section.sectionId },
        });

        if (!sectionExists) {
          throw new BadRequestException(
            `Section with ID ${section.sectionId} does not exist`,
          );
        }

        // Upsert section config
        const result = await tx.seoSectionLazyLoading.upsert({
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
}

