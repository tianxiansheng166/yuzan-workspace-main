import { ConsentVersionNotFoundException } from "../domain/privacy.errors.js";
import type { ConsentRepositoryPort } from "./consent-repository.port.js";

export class UnavailableConsentRepository implements ConsentRepositoryPort {
  async list(): Promise<never> {
    throw new ConsentVersionNotFoundException("同意版本仓库不可用");
  }
  async findById(): Promise<never> {
    throw new ConsentVersionNotFoundException("同意版本仓库不可用");
  }
  async findByPurposeAndVersion(): Promise<never> {
    throw new ConsentVersionNotFoundException("同意版本仓库不可用");
  }
  async save(): Promise<never> {
    throw new ConsentVersionNotFoundException("同意版本仓库不可用");
  }
}
