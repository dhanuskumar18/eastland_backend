import { Module } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { YouTubeVideosModule } from '../youtube-videos/youtube-videos.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [YouTubeVideosModule, CommonModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}


