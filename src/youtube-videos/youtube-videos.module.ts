import { Module } from '@nestjs/common';
import { YouTubeVideosService } from './youtube-videos.service';
import { YouTubeVideosController } from './youtube-videos.controller';

@Module({
  controllers: [YouTubeVideosController],
  providers: [YouTubeVideosService],
})
export class YouTubeVideosModule {}

