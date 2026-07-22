export const CLASS_ENROLLMENT_LOOKUP = Symbol("CLASS_ENROLLMENT_LOOKUP");

export interface ClassEnrollmentLookupPort {
  classExistsAndBelongsToSchool(
    schoolId: string,
    classId: string,
  ): Promise<boolean>;

  isUserEnrolledInClass(
    schoolId: string,
    classId: string,
    userId: string,
  ): Promise<boolean>;

  listStudentEnrollmentIds(
    schoolId: string,
    classId: string,
  ): Promise<readonly string[]>;

  findEnrollmentId(
    schoolId: string,
    userId: string,
    classId: string,
  ): Promise<string | null>;
}
