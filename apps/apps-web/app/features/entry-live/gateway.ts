import type { ApiEnvelope, CurrentUserResponse, MembershipRole } from "../../lib/api/types";
import type { Paginated, ProductApiPort, SchoolContext } from "../live-core/gateway";
import { ActiveSchoolRequiredError } from "../live-core/gateway";

export interface PublicPlan { id: string; name?: string; title?: string; description?: string; priceLabel?: string; status?: string; features?: string[] }
export interface VolunteerSummary { id: string; displayName: string; status: string; appliedAt: string }
export interface TrainingProgram { id: string; title: string; description?: string; status: string; modules: Array<{id:string;title:string;required:boolean;durationMinutes?:number}> }
export interface SupportPairing { id: string; goal: string; status: string; consentStatus?: string }
export interface IntegrationConfig { id:string; key:string; enabled:boolean; mode:string; publicUrl:string|null; status:string; lastCheckedAt:string|null }
export interface MindGraphJob { id:string; status:string; errorCode:string|null; createdAt:string }
export interface TranslationJob { id:string; status:string; sourceLanguage?:string; targetLanguage?:string; errorCode?:string|null; createdAt?:string }
export interface VolunteerOverview { context:SchoolContext; volunteers:VolunteerSummary[]; training:TrainingProgram[]; pairings:SupportPairing[] }
export interface ToolsOverview { context:SchoolContext; integrations:IntegrationConfig[]; jobs:MindGraphJob[]; translations:TranslationJob[]; glossaryCount:number }

async function resolveContext(api: ProductApiPort): Promise<SchoolContext> {
  const response: CurrentUserResponse = await api.currentUser();
  const schoolId=response.data.activeSchoolId;
  const membership=response.data.memberships.find(item=>item.schoolId===schoolId);
  if(!schoolId||!membership) throw new ActiveSchoolRequiredError();
  return {schoolId,schoolName:membership.schoolName,role:membership.role as MembershipRole};
}

export function createEntryLiveGateway(api: ProductApiPort){
  const schoolPath=(schoolId:string,path:string)=>`/schools/${schoolId}${path}`;
  return {
    async plans(){const response=await api.request<ApiEnvelope<{items:PublicPlan[];nextCursor:string|null;hasMore:boolean}>>("/plans");return response.data.items;},
    async adminSchools(){return api.request<ApiEnvelope<Paginated<Record<string,unknown>>>>("/admin/schools");},
    async researchVersions(){return api.request<ApiEnvelope<Paginated<Record<string,unknown>>>>("/research/governance/versions");},
    async volunteerOverview():Promise<VolunteerOverview>{
      const context=await resolveContext(api);
      const isManager=context.role==="TEACHER"||context.role==="SCHOOL_ADMIN"||context.role==="PLATFORM_ADMIN";
      const volunteerPath=isManager?"/volunteers?limit=50":"/volunteers/me";
      const pairingPath=isManager?"/support-pairings?limit=50":"/support-pairings/me/pairings";
      const [volunteerResult,trainingResult,pairingResult]=await Promise.all([
        api.request<ApiEnvelope<Paginated<VolunteerSummary>|VolunteerSummary>>(schoolPath(context.schoolId,volunteerPath)),
        api.request<ApiEnvelope<Paginated<TrainingProgram>>>(schoolPath(context.schoolId,"/training?limit=50")),
        api.request<ApiEnvelope<Paginated<SupportPairing>|SupportPairing[]>>(schoolPath(context.schoolId,pairingPath)),
      ]);
      const volunteers="items" in volunteerResult.data?volunteerResult.data.items:[volunteerResult.data];
      const pairings=Array.isArray(pairingResult.data)?pairingResult.data:pairingResult.data.items;
      return {context,volunteers,training:trainingResult.data.items,pairings};
    },
    async toolsOverview():Promise<ToolsOverview>{
      const context=await resolveContext(api);
      const [integrations,jobs,translations,glossary]=await Promise.all([
        api.request<ApiEnvelope<IntegrationConfig[]>>(schoolPath(context.schoolId,"/tools/integrations")),
        api.request<ApiEnvelope<Paginated<MindGraphJob>>>(schoolPath(context.schoolId,"/tools/mindgraph/jobs?limit=20")),
        api.request<ApiEnvelope<Paginated<TranslationJob>>>(schoolPath(context.schoolId,"/translations/jobs/me?limit=20")),
        api.request<ApiEnvelope<unknown[]>>(schoolPath(context.schoolId,"/translations/glossary")),
      ]);
      return {context,integrations:integrations.data,jobs:jobs.data.items,translations:translations.data.items,glossaryCount:glossary.data.length};
    },
    async createMindGraphJob(inputPayload:Record<string,unknown>){const context=await resolveContext(api);const response=await api.request<ApiEnvelope<MindGraphJob>>(schoolPath(context.schoolId,"/tools/mindgraph/jobs"),{method:"POST",body:JSON.stringify({inputPayload})});return response.data;},
    async getMindGraphJob(jobId:string){const context=await resolveContext(api);const response=await api.request<ApiEnvelope<MindGraphJob>>(schoolPath(context.schoolId,`/tools/mindgraph/jobs/${jobId}`));return response.data;},
    async createTranslation(input:{sourceLanguage:string;targetLanguage:string;sourceText:string}){const context=await resolveContext(api);const response=await api.request<ApiEnvelope<TranslationJob>>(schoolPath(context.schoolId,"/translations/jobs"),{method:"POST",body:JSON.stringify(input)});return response.data;},
    async getTranslationJob(jobId:string){const context=await resolveContext(api);const response=await api.request<ApiEnvelope<TranslationJob>>(schoolPath(context.schoolId,`/translations/jobs/${jobId}`));return response.data;},    async auditToolClick(key:string,action:string,targetUrl?:string){const context=await resolveContext(api);const response=await api.request<ApiEnvelope<{id:string}>>(schoolPath(context.schoolId,"/tools/click-audit"),{method:"POST",body:JSON.stringify({integrationKey:key,action,targetUrl})});return response.data;},
  };
}