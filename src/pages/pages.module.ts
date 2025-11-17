import { Module } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { YouTubeVideosModule } from '../youtube-videos/youtube-videos.module';

@Module({
  imports: [YouTubeVideosModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}


