import { Injectable } from "@nestjs/common";
import type { SystemProviderSecret } from "../domain/provider.types.js";
import { ProviderUnavailableException } from "../domain/provider.errors.js";
import type { ProviderSecretRepositoryPort } from "./provider-secret-repository.port.js";

@Injectable()
export class UnavailableProviderSecretRepository
  implements ProviderSecretRepositoryPort
{
  async findByProviderId(
    _providerId: string,
  ): Promise<readonly SystemProviderSecret[]> {
    throw new ProviderUnavailableException();
  }

  async save(_secret: SystemProviderSecret): Promise<SystemProviderSecret> {
    throw new ProviderUnavailableException();
  }

  async delete(_id: string): Promise<boolean> {
    throw new ProviderUnavailableException();
  }
}
