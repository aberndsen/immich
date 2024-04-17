import { Inject, Injectable } from '@nestjs/common';
import { AccessCore, AccessPermission } from 'src/cores/access.core';
import {
  ActivityCreateDto,
  ActivityDto,
  ActivityResponseDto,
  ActivitySearchDto,
  ActivityStatisticsResponseDto,
  MaybeDuplicate,
  ReactionLevel,
  ReactionType,
  mapActivity,
} from 'src/dtos/activity.dto';
import { AuthDto } from 'src/dtos/auth.dto';
import { ActivityEntity } from 'src/entities/activity.entity';
import { IAccessRepository } from 'src/interfaces/access.interface';
import { IActivityRepository } from 'src/interfaces/activity.interface';

@Injectable()
export class ActivityService {
  private access: AccessCore;

  constructor(
    @Inject(IAccessRepository) accessRepository: IAccessRepository,
    @Inject(IActivityRepository) private repository: IActivityRepository,
  ) {
    this.access = AccessCore.create(accessRepository);
  }

  async getAll(auth: AuthDto, dto: ActivitySearchDto): Promise<ActivityResponseDto[]> {
    await this.access.requirePermission(auth, AccessPermission.ALBUM_READ, dto.albumId);
    const activities = await this.repository.search({
      userId: dto.userId,
      albumId: dto.albumId,
      assetId: dto.level === ReactionLevel.ALBUM ? null : dto.assetId,
      isLiked: dto.type && dto.type === ReactionType.LIKE,
    });

    return activities.map((activity) => mapActivity(activity));
  }

  async getStatistics(auth: AuthDto, dto: ActivityDto): Promise<ActivityStatisticsResponseDto> {
    await this.access.requirePermission(auth, AccessPermission.ALBUM_READ, dto.albumId);
    return { comments: await this.repository.getStatistics(dto.assetId, dto.albumId) };
  }

  async create(auth: AuthDto, dto: ActivityCreateDto): Promise<MaybeDuplicate<ActivityResponseDto>> {
    await this.access.requirePermission(auth, AccessPermission.ACTIVITY_CREATE, dto.albumId);

    const common = {
      userId: auth.user.id,
      assetId: dto.assetId,
      albumId: dto.albumId,
    };

    let activity: ActivityEntity | null = null;
    let duplicate = false;

    if (dto.type === ReactionType.LIKE) {
      delete dto.comment;
      [activity] = await this.repository.search({
        ...common,
        // `null` will search for an album like
        assetId: dto.assetId ?? null,
        isLiked: true,
      });
      duplicate = !!activity;
    }

    if (!activity) {
      activity = await this.repository.create({
        ...common,
        isLiked: dto.type === ReactionType.LIKE,
        comment: dto.comment,
      });
    }

    return { duplicate, value: mapActivity(activity) };
  }

  async delete(auth: AuthDto, id: string): Promise<void> {
    await this.access.requirePermission(auth, AccessPermission.ACTIVITY_DELETE, id);
    await this.repository.delete(id);
  }
}
