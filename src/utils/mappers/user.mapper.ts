// src/utils/mappers/user.mapper.ts
import { User, UserResponse } from "../../types/user.types";

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}
