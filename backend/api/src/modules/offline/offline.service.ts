import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import type { OfflineRepositoryPort, ListOfflinePackagesOptions, CreateOfflinePackageData, CreateSyncBatchData } from "./ports/offline-repository.port.js";
import { OFFLINE_REPOSITORY } from "./ports/offline-repository.port.js";
import { OfflinePackageForbiddenException, OfflinePackageNotFoundException, SyncBatchConflictException, SyncBatchNotFoundException } from "./domain/offline.errors.js";
import { OfflinePolicy } from "./offline.policy.js";
import { toPackageDetailResponse, toPackageSummaryResponse, toSyncBatchResponse, toDownloadAuthorizationResponse } from "./dto/offline-response.js";

@Injectable()
export class OfflineService {
  private readonly policy = new OfflinePolicy();

  constructor(
    @Inject(OFFLINE_REPOSITORY)
    private readonly offlineRepo: OfflineRepositoryPort,
  ) {}

  async listPackages(auth: AuthContext, schoolId: string, options: ListOfflinePackagesOptions) {
    if (!this.policy.canListPackages(auth, schoolId)) throw new OfflinePackageForbiddenException();
    const result = await this.offlineRepo.listPackages(schoolId, options);
    return { items: result.items.map(toPackageSummaryResponse), nextCursor: result.nextCursor, hasMore: result.hasMore };
  }

  async createPackage(auth: AuthContext, schoolId: string, data: Omit<CreateOfflinePackageData, "schoolId">) {
    if (!this.policy.canCreatePackage(auth, schoolId)) throw new OfflinePackageForbiddenException();
    const pkg = await this.offlineRepo.createPackage({ ...data, schoolId });
    return toPackageSummaryResponse(pkg);
  }

  async getPackage(auth: AuthContext, schoolId: string, packageId: string) {
    if (!this.policy.canReadPackage(auth, schoolId)) throw new OfflinePackageForbiddenException();
    const pkg = await this.offlineRepo.findPackageById(schoolId, packageId);
    if (!pkg) throw new OfflinePackageNotFoundException();
    return toPackageDetailResponse(pkg);
  }

  async authorizeDownload(auth: AuthContext, schoolId: string, packageId: string) {
    if (!this.policy.canAuthorizeDownload(auth, schoolId)) throw new OfflinePackageForbiddenException();
    const authResult = await this.offlineRepo.authorizeDownload(schoolId, packageId, auth.principal.userId);
    return toDownloadAuthorizationResponse(authResult);
  }

  async createSyncBatch(auth: AuthContext, schoolId: string, data: Omit<CreateSyncBatchData, "schoolId">) {
    if (!this.policy.canCreateSyncBatch(auth, schoolId)) throw new OfflinePackageForbiddenException();
    const existing = await this.offlineRepo.findBatchByClientBatchId(data.clientBatchId);
    if (existing) throw new SyncBatchConflictException();
    const batch = await this.offlineRepo.createBatch({ ...data, schoolId });
    return toSyncBatchResponse(batch);
  }

  async getSyncBatch(auth: AuthContext, schoolId: string, batchId: string) {
    if (!this.policy.canReadSyncBatch(auth, schoolId)) throw new OfflinePackageForbiddenException();
    const batch = await this.offlineRepo.findBatchById(schoolId, batchId);
    if (!batch) throw new SyncBatchNotFoundException();
    return toSyncBatchResponse(batch);
  }
}
