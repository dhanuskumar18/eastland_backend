import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseFilters,
  Header,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { SeoService } from './seo.service';
import { OptimizeImageDto } from './dto/optimize-image.dto';
import { LazyLoadingSettingsDto, SectionLazyLoadingDto } from './dto/lazy-loading.dto';
import { CreateGlobalSeoDto } from './dto/create-global-seo.dto';
import { UpdateGlobalSeoDto } from './dto/update-global-seo.dto';
import { CreatePageSeoDto } from './dto/create-page-seo.dto';
import { UpdatePageSeoDto } from './dto/update-page-seo.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { JwtGuard } from 'src/auth/guard';
import { ValidationExceptionFilter } from './filters/validation-exception.filter';
import { memoryStorage } from 'multer';

@Controller('api/seo')
@UseFilters(ValidationExceptionFilter)
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Post('optimize-image')
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async optimizeImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    // Extract and validate form data
    const compressionLevel = body.compressionLevel || 'medium';
    const format = body.format || 'webp';

    // Validate compression level
    const validCompressionLevels = ['low', 'medium', 'high', 'maximum'];
    if (!validCompressionLevels.includes(compressionLevel)) {
      throw new BadRequestException(
        `Invalid compression level. Must be one of: ${validCompressionLevels.join(', ')}`,
      );
    }

    // Validate format
    const validFormats = ['webp', 'jpeg', 'jpg', 'png', 'avif'];
    if (!validFormats.includes(format.toLowerCase())) {
      throw new BadRequestException(
        `Invalid format. Must be one of: ${validFormats.join(', ')}`,
      );
    }

    const result = await this.seoService.optimizeImage(
      file,
      compressionLevel,
      format.toLowerCase(),
    );

    return {
      success: true,
      data: result,
    };
  }

  // Lazy Loading Endpoints

  @Get('lazy-loading')
  @Header('Cache-Control', 'no-cache, must-revalidate')
  async getLazyLoadingSettings() {
    try {
      const data = await this.seoService.getLazyLoadingSettings();
      return {
        success: true,
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          success: false,
          message: error.message,
        };
      }
      throw error;
    }
  }

  @Post('lazy-loading')
  @Header('Cache-Control', 'no-store')
  async saveLazyLoadingSettings(@Body() dto: LazyLoadingSettingsDto) {
    try {
      const data = await this.seoService.saveLazyLoadingSettings(dto);
      return {
        success: true,
        message: 'Lazy loading settings saved successfully',
        data,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('lazy-loading/sections')
  @Header('Cache-Control', 'no-cache, must-revalidate')
  async getSectionLazyLoadingConfigs() {
    try {
      const data = await this.seoService.getSectionLazyLoadingConfigs();
      return {
        success: true,
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          success: false,
          message: error.message,
        };
      }
      throw error;
    }
  }

  @Post('lazy-loading/sections')
  @Header('Cache-Control', 'no-store')
  async saveSectionLazyLoadingConfigs(@Body() dto: SectionLazyLoadingDto) {
    try {
      const data = await this.seoService.saveSectionLazyLoadingConfigs(dto);
      return {
        success: true,
        message: 'Section lazy loading configurations saved successfully',
        data,
      };
    } catch (error) {
      throw error;
    }
  }

  // Global SEO Endpoints

  @Get('global')
  @SkipCsrf()
  @SkipThrottle()
  @Header('Cache-Control', 'no-cache, must-revalidate')
  async getGlobalSeo() {
    try {
      const data = await this.seoService.getGlobalSeo();
      return {
        version: '1',
        code: 200,
        status: true,
        message: 'Global SEO settings retrieved successfully',
        validationErrors: [],
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          version: '1',
          code: 404,
          status: false,
          message: 'Global SEO settings not found',
          validationErrors: [],
          data: null,
        };
      }
      throw error;
    }
  }

  @Post('global')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async createOrUpdateGlobalSeo(@Body() dto: CreateGlobalSeoDto) {
    try {
      const data = await this.seoService.createOrUpdateGlobalSeo(dto);
      return {
        version: '1',
        code: 200,
        status: true,
        message: 'Global SEO settings saved successfully',
        validationErrors: [],
        data,
      };
    } catch (error) {
      throw error;
    }
  }

  @Patch('global')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async updateGlobalSeo(@Body() dto: UpdateGlobalSeoDto) {
    try {
      const data = await this.seoService.updateGlobalSeo(dto);
      return {
        version: '1',
        code: 200,
        status: true,
        message: 'Global SEO settings updated successfully',
        validationErrors: [],
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          version: '1',
          code: 404,
          status: false,
          message: 'Global SEO settings not found',
          validationErrors: [],
          data: null,
        };
      }
      throw error;
    }
  }

  // Page SEO Endpoints

    @Get('pages/:pageId')
    @SkipCsrf()
    @SkipThrottle()
    @Header('Cache-Control', 'no-cache, must-revalidate')
    async getPageSeo(@Param('pageId', ParseIntPipe) pageId: number) {
    try {
      const data = await this.seoService.getPageSeo(pageId);
      return {
        version: '1',
        code: 200,
        status: true,
        message: 'Page SEO settings retrieved successfully',
        validationErrors: [],
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          version: '1',
          code: 404,
          status: false,
          message: 'Page SEO settings not found',
          validationErrors: [],
          data: null,
        };
      }
      throw error;
    }
  }

  @Get('pages/slug/:slug')
  @SkipCsrf()
  @SkipThrottle()
  @Header('Cache-Control', 'no-cache, must-revalidate')
  async getPageSeoBySlug(@Param('slug') slug: string) {
    try {
      const data = await this.seoService.getPageSeoBySlug(slug);
      return {
        version: '1',
        code: 200,
        status: true,
        message: 'Page SEO settings retrieved successfully',
        validationErrors: [],
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          version: '1',
          code: 404,
          status: false,
          message: 'Page SEO settings not found',
          validationErrors: [],
          data: null,
        };
      }
      throw error;
    }
  }

  @Post('pages')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  async createPageSeo(@Body() dto: CreatePageSeoDto) {
    try {
      const data = await this.seoService.createPageSeo(dto);
      return {
        version: '1',
        code: 201,
        status: true,
        message: 'Page SEO settings created successfully',
        validationErrors: [],
        data,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        return {
          version: '1',
          code: 409,
          status: false,
          message: 'SEO settings already exist for this page. Use PATCH to update.',
          validationErrors: [],
          data: null,
        };
      }
      throw error;
    }
  }

  @Patch('pages/:pageId')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async updatePageSeo(
    @Param('pageId', ParseIntPipe) pageId: number,
    @Body() dto: UpdatePageSeoDto,
  ) {
    try {
      const data = await this.seoService.updatePageSeo(pageId, dto);
      return {
        version: '1',
        code: 200,
        status: true,
        message: 'Page SEO settings updated successfully',
        validationErrors: [],
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          version: '1',
          code: 404,
          status: false,
          message: 'Page SEO settings not found',
          validationErrors: [],
          data: null,
        };
      }
      throw error;
    }
  }
}

