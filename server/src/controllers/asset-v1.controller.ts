import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Next,
  Param,
  ParseFilePipe,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import { NextFunction, Response } from 'express';
import { AssetResponseDto } from 'src/dtos/asset-response.dto';
import {
  AssetBulkUploadCheckResponseDto,
  AssetFileUploadResponseDto,
  CheckExistingAssetsResponseDto,
  CuratedLocationsResponseDto,
  CuratedObjectsResponseDto,
} from 'src/dtos/asset-v1-response.dto';
import {
  AssetBulkUploadCheckDto,
  AssetSearchDto,
  CheckExistingAssetsDto,
  CreateAssetDto,
  GetAssetThumbnailDto,
  ServeFileDto,
} from 'src/dtos/asset-v1.dto';
import { AuthDto, Permission } from 'src/dtos/auth.dto';
import { Auth, Authenticated, FileResponse } from 'src/middleware/auth.guard';
import { FileUploadInterceptor, ImmichFile, Route, mapToUploadFile } from 'src/middleware/file-upload.interceptor';
import { AssetServiceV1 } from 'src/services/asset-v1.service';
import { sendFile } from 'src/utils/file';
import { FileNotEmptyValidator, UUIDParamDto } from 'src/validation';

interface UploadFiles {
  assetData: ImmichFile[];
  livePhotoData?: ImmichFile[];
  sidecarData: ImmichFile[];
}

@ApiTags('Asset')
@Controller(Route.ASSET)
export class AssetControllerV1 {
  constructor(private service: AssetServiceV1) {}

  @Post('upload')
  @Authenticated(Permission.ASSET_UPLOAD, { sharedLink: true })
  @UseInterceptors(FileUploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Asset Upload Information',
    type: CreateAssetDto,
  })
  async uploadFile(
    @Auth() auth: AuthDto,
    @UploadedFiles(new ParseFilePipe({ validators: [new FileNotEmptyValidator(['assetData'])] })) files: UploadFiles,
    @Body() dto: CreateAssetDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AssetFileUploadResponseDto> {
    const file = mapToUploadFile(files.assetData[0]);
    const _livePhotoFile = files.livePhotoData?.[0];
    const _sidecarFile = files.sidecarData?.[0];
    let livePhotoFile;
    if (_livePhotoFile) {
      livePhotoFile = mapToUploadFile(_livePhotoFile);
    }

    let sidecarFile;
    if (_sidecarFile) {
      sidecarFile = mapToUploadFile(_sidecarFile);
    }

    const responseDto = await this.service.uploadFile(auth, dto, file, livePhotoFile, sidecarFile);
    if (responseDto.duplicate) {
      res.status(HttpStatus.OK);
    }

    return responseDto;
  }

  @Get('/file/:id')
  @Authenticated(Permission.ASSET_VIEW_ORIGINAL, { sharedLink: true })
  @FileResponse()
  async serveFile(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Query() dto: ServeFileDto,
  ) {
    await sendFile(res, next, () => this.service.serveFile(auth, id, dto));
  }

  @Get('/thumbnail/:id')
  @Authenticated(Permission.ASSET_VIEW_THUMB, { sharedLink: true })
  @FileResponse()
  async getAssetThumbnail(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Query() dto: GetAssetThumbnailDto,
  ) {
    await sendFile(res, next, () => this.service.serveThumbnail(auth, id, dto));
  }

  @Get('/curated-objects')
  @Authenticated(Permission.ASSET_READ)
  getCuratedObjects(@Auth() auth: AuthDto): Promise<CuratedObjectsResponseDto[]> {
    return this.service.getCuratedObject(auth);
  }

  @Get('/curated-locations')
  @Authenticated(Permission.ASSET_READ)
  getCuratedLocations(@Auth() auth: AuthDto): Promise<CuratedLocationsResponseDto[]> {
    return this.service.getCuratedLocation(auth);
  }

  @Get('/search-terms')
  @Authenticated(Permission.ASSET_READ)
  getAssetSearchTerms(@Auth() auth: AuthDto): Promise<string[]> {
    return this.service.getAssetSearchTerm(auth);
  }

  /**
   * Get all AssetEntity belong to the user
   */
  @Get('/')
  @Authenticated(Permission.ASSET_READ)
  @ApiHeader({
    name: 'if-none-match',
    description: 'ETag of data already cached on the client',
    required: false,
    schema: { type: 'string' },
  })
  getAllAssets(@Auth() auth: AuthDto, @Query() dto: AssetSearchDto): Promise<AssetResponseDto[]> {
    return this.service.getAllAssets(auth, dto);
  }

  /**
   * Checks if multiple assets exist on the server and returns all existing - used by background backup
   */
  @Post('/exist')
  @Authenticated(Permission.ASSET_READ)
  @HttpCode(HttpStatus.OK)
  checkExistingAssets(
    @Auth() auth: AuthDto,
    @Body() dto: CheckExistingAssetsDto,
  ): Promise<CheckExistingAssetsResponseDto> {
    return this.service.checkExistingAssets(auth, dto);
  }

  /**
   * Checks if assets exist by checksums
   */
  @Post('/bulk-upload-check')
  @Authenticated(Permission.ASSET_READ)
  @HttpCode(HttpStatus.OK)
  checkBulkUpload(
    @Auth() auth: AuthDto,
    @Body() dto: AssetBulkUploadCheckDto,
  ): Promise<AssetBulkUploadCheckResponseDto> {
    return this.service.bulkUploadCheck(auth, dto);
  }
}
