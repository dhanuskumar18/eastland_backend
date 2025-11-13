import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SeoService } from './seo.service';
import { OptimizeImageDto } from './dto/optimize-image.dto';
import { LazyLoadingSettingsDto, SectionLazyLoadingDto } from './dto/lazy-loading.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { memoryStorage } from 'multer';

@SkipCsrf()
@Controller('api/seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Post('optimize-image')
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
}

