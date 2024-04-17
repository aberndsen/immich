import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AssetResponseDto } from 'src/dtos/asset-response.dto';
import { AuthDto, Permission } from 'src/dtos/auth.dto';
import { AssetDeltaSyncDto, AssetDeltaSyncResponseDto, AssetFullSyncDto } from 'src/dtos/sync.dto';
import { Auth, Authenticated } from 'src/middleware/auth.guard';
import { SyncService } from 'src/services/sync.service';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private service: SyncService) {}

  @Get('full-sync')
  @Authenticated(Permission.ASSET_READ)
  getAllForUserFullSync(@Auth() auth: AuthDto, @Query() dto: AssetFullSyncDto): Promise<AssetResponseDto[]> {
    return this.service.getAllAssetsForUserFullSync(auth, dto);
  }

  @Get('delta-sync')
  @Authenticated(Permission.ASSET_READ)
  getDeltaSync(@Auth() auth: AuthDto, @Query() dto: AssetDeltaSyncDto): Promise<AssetDeltaSyncResponseDto> {
    return this.service.getChangesForDeltaSync(auth, dto);
  }
}
