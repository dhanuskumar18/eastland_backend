import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { PaginationDto } from './dto/pagination.dto';
import { TestimonialFilterDto } from './dto/filter.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class TestimonialsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly uploadService: UploadService,
  ) {}

  async create(dto: CreateTestimonialDto) {
    const testimonial = await this.db.testimonial.create({
      data: {
        clientName: dto.clientName,
        profession: dto.profession,
        review: dto.review,
        imageUrl: dto.imageUrl,
      },
    });

    return {
      status: true,
      code: 200,
      message: 'Testimonial created successfully',
      data: testimonial,
    };
  }

  async findAll(paginationDto?: PaginationDto, filterDto?: TestimonialFilterDto) {
    // Build where clause for filtering
    const where: any = {};

    if (filterDto?.search) {
      const searchLower = filterDto.search.toLowerCase();
      where.OR = [
        { clientName: { contains: searchLower, mode: 'insensitive' } },
        { profession: { contains: searchLower, mode: 'insensitive' } },
        { review: { contains: searchLower, mode: 'insensitive' } },
      ];
    }

    // If pagination is provided, return paginated results
    if (paginationDto && (paginationDto.page !== undefined || paginationDto.limit !== undefined)) {
      const page = paginationDto.page ?? 1;
      const limit = paginationDto.limit ?? 10;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.db.testimonial.findMany({
          where,
          skip,
          take: limit,
          orderBy: { id: 'desc' },
        }),
        this.db.testimonial.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        status: true,
        code: 200,
        data,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    }

    // Return all results if no pagination
    const data = await this.db.testimonial.findMany({
      where,
      orderBy: { id: 'desc' },
    });
    return {
      status: true,
      code: 200,
      data,
    };
  }

  async findOne(id: number) {
    const testimonial = await this.db.testimonial.findUnique({ where: { id } });
    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    return {
      status: true,
      code: 200,
      data: testimonial,
    };
  }

  async update(id: number, dto: UpdateTestimonialDto) {
    const existing = await this.db.testimonial.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Testimonial not found');
    }

    const data: {
      clientName?: string;
      profession?: string;
      review?: string;
      imageUrl?: string;
    } = {};

    if (dto.clientName !== undefined) {
      data.clientName = dto.clientName;
    }
    if (dto.profession !== undefined) {
      data.profession = dto.profession;
    }
    if (dto.review !== undefined) {
      data.review = dto.review;
    }
    if (dto.imageUrl !== undefined) {
      // Delete old image if a new one is being provided and it's different
      if (existing.imageUrl && dto.imageUrl !== existing.imageUrl) {
        try {
          await this.uploadService.deleteFile(existing.imageUrl);
        } catch (error) {
          // Log error but don't fail the update
          console.error('Error deleting old image:', error);
        }
      }
      data.imageUrl = dto.imageUrl;
    }

    if (Object.keys(data).length === 0) {
      return {
        status: true,
        code: 200,
        message: 'Testimonial updated successfully',
        data: existing,
      };
    }

    const updated = await this.db.testimonial.update({
      where: { id },
      data,
    });

    return {
      status: true,
      code: 200,
      message: 'Testimonial updated successfully',
      data: updated,
    };
  }

  async remove(id: number) {
    // Get testimonial details BEFORE deleting (needed for matching in sections)
    const testimonial = await this.db.testimonial.findUnique({
      where: { id },
      select: {
        id: true,
        imageUrl: true,
        clientName: true,
        profession: true,
        review: true,
      },
    });

    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    // Remove testimonial references from page sections BEFORE deleting
    await this.removeTestimonialFromSections(id, testimonial.imageUrl, testimonial.clientName);

    // Delete the associated image from S3
    if (testimonial.imageUrl) {
      try {
        await this.uploadService.deleteFile(testimonial.imageUrl);
      } catch (error) {
        // Log error but don't fail the deletion
        console.error('Error deleting image:', error);
      }
    }

    await this.db.testimonial.delete({ where: { id } });

    return {
      status: true,
      code: 200,
      message: 'Testimonial deleted successfully',
    };
  }

  /**
   * Remove testimonial references from all page sections
   * Uses id as primary match, falls back to imageUrl or clientName if id is missing
   */
  private async removeTestimonialFromSections(
    testimonialId: number,
    imageUrl: string | null,
    clientName: string | null,
  ) {
    try {
      console.log(`Starting removal of testimonial ${testimonialId} from sections (image: ${imageUrl}, name: ${clientName})`);
      
      // Get all section translations
      const translations = await this.db.sectionTranslation.findMany({
        select: { id: true, content: true },
      });

      console.log(`Found ${translations.length} section translations to check`);

      let totalRemoved = 0;
      // Process each translation
      for (const translation of translations) {
        const content = translation.content as any;
        let updated = false;

        // Check if content has reviews array (testimonials section)
        if (content?.reviews && Array.isArray(content.reviews)) {
          const originalLength = content.reviews.length;
          
          // Remove reviews that reference this testimonial
          // Primary match: id or tempId
          // Fallback match: imageUrl or clientName (for legacy reviews without id)
          content.reviews = content.reviews.filter(
            (review: any) => {
              const reviewId = review?.id || review?.tempId;
              const reviewImage = review?.image || review?.imageUrl;
              const reviewName = review?.name || review?.clientName;
              
              // Primary match: Check by id or tempId
              if (reviewId != null && reviewId !== undefined) {
                const matchesById = String(reviewId) === String(testimonialId) || 
                                  Number(reviewId) === Number(testimonialId);
                if (matchesById) {
                  console.log(`Removing review with id ${reviewId} (matches ${testimonialId})`);
                  return false; // Remove this review
                }
                return true; // Keep this review (different id)
              }
              
              // Fallback match: Check by image URL
              if (imageUrl && reviewImage) {
                const imageMatches = reviewImage === imageUrl || 
                                   reviewImage.includes(imageUrl.split('/').pop() || '') ||
                                   imageUrl.includes(reviewImage.split('/').pop() || '');
                if (imageMatches) {
                  console.log(`Removing review with matching image URL: ${reviewImage}`);
                  return false; // Remove this review
                }
              }
              
              // Fallback match: Check by client name
              if (clientName && reviewName) {
                const nameMatches = reviewName.toLowerCase().trim() === clientName.toLowerCase().trim();
                if (nameMatches) {
                  console.log(`Removing review with matching name: ${reviewName}`);
                  return false; // Remove this review
                }
              }
              
              // Keep review if no matches found
              return true;
            },
          );
          
          if (content.reviews.length !== originalLength) {
            updated = true;
            totalRemoved += (originalLength - content.reviews.length);
            console.log(`Translation ${translation.id}: Removed ${originalLength - content.reviews.length} review(s)`);
          }
        }

        // Update translation if changes were made
        if (updated) {
          await this.db.sectionTranslation.update({
            where: { id: translation.id },
            data: { content: content },
          });
          console.log(`Translation ${translation.id}: Updated successfully`);
        }
      }
      
      console.log(`Completed: Removed testimonial ${testimonialId} from ${totalRemoved} review(s) across all sections`);
    } catch (error) {
      // Log error but don't fail the deletion
      console.error(`Error removing testimonial ${testimonialId} from sections:`, error);
    }
  }
}
