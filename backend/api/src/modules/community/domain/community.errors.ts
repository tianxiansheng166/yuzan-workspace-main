import { HttpException, HttpStatus } from "@nestjs/common";

export class CommunityPostNotFoundException extends HttpException {
  constructor(message = "帖子不存在") {
    super({ code: "COMMUNITY_POST_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class CommunityForbiddenException extends HttpException {
  constructor(message = "无权访问该社区内容") {
    super({ code: "COMMUNITY_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class CommunityUnavailableException extends HttpException {
  constructor(message = "社区数据服务暂不可用") {
    super(
      { code: "COMMUNITY_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class CommunityInvalidTransitionException extends HttpException {
  constructor(message = "帖子状态转换无效") {
    super(
      { code: "COMMUNITY_INVALID_TRANSITION", message },
      HttpStatus.CONFLICT,
    );
  }
}

export class CommunityCommentNotFoundException extends HttpException {
  constructor(message = "评论不存在") {
    super(
      { code: "COMMUNITY_COMMENT_NOT_FOUND", message },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class CommunityReportNotFoundException extends HttpException {
  constructor(message = "举报记录不存在") {
    super(
      { code: "COMMUNITY_REPORT_NOT_FOUND", message },
      HttpStatus.NOT_FOUND,
    );
  }
}
