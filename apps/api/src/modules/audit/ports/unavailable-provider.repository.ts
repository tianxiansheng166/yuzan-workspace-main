import { Injectable } from "@nestjs/common";
import type { ProviderType, SystemProvider } from "../domain/provider.types.js";
import { ProviderUnavailableException } from "../domain/provider.errors.js";
import type { ProviderRepositoryPort } from "./provider-repository.port.js";

@Injectable()
export class UnavailableProviderRepository implements ProviderRepositoryPort {
  async findById(_id: string): Promise<SystemProvider | null> {
    throw new ProviderUnavailableException();
  }

  async list(
    _type?: ProviderType,
    _enabled?: boolean,
  ): Promise<readonly SystemProvider[]> {
    throw new ProviderUnavailableException();
  }

  async save(_provider: SystemProvider): Promise<SystemProvider> {
    throw new ProviderUnavailableException();
  }

  async delete(_id: string): Promise<boolean> {
    throw new ProviderUnavailableException();
  }
}
