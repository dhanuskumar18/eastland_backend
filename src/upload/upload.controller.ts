import {
  Controller,
  Post,
  Delete,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { SkipCsrf } from 'src/auth/csrf';
import { JwtGuard, PermissionsGuard } from 'src/auth/guard';
import { Permissions } from 'src/auth/decorator';
import { memoryStorage } from 'multer';

@SkipCsrf()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('upload:create')
  @Post('image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    const folderPath = folder || 'uploads';
    const url = await this.uploadService.uploadFile(file, folderPath);

    return {
      success: true,
      message: 'Image uploaded successfully',
      url,
    };
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('upload:create')
  @Post('images')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
      },
    }),
  )
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folder') folder?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No image files provided');
    }

    const folderPath = folder || 'uploads';
    const urls = await this.uploadService.uploadMultipleFiles(files, folderPath);

    return {
      success: true,
      message: 'Images uploaded successfully',
      urls,
      count: urls.length,
    };
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('upload:create')
  @Post('product-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    const url = await this.uploadService.uploadFile(file, 'products');

    return {
      success: true,
      message: 'Product image uploaded successfully',
      url,
    };
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('upload:delete')
  @Delete()
  async deleteFile(@Body('url') url: string) {
    if (!url) {
      throw new BadRequestException('File URL is required');
    }

    await this.uploadService.deleteFile(url);

    return {
      success: true,
      message: 'File deleted successfully',
    };
  }
}

