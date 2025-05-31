import { createUserDual } from "./dataSync";

export const createUser = createUserDual;
export const getUsers = async (options: any) => {
  const { prisma } = require("../database");
  const users = await prisma.user.findMany();
  return { users, totalCount: users.length, pages: 1, currentPage: 1 };
};
export const getUserById = async (userId: string) => {
  const { prisma } = require("../database");
  return await prisma.user.findUnique({ where: { id: userId } });
};
export const updateUser = async (userId: string, updateData: any) => {
  const { prisma } = require("../database");
  return await prisma.user.update({ where: { id: userId }, data: updateData });
};
export const deleteUser = async (userId: string) => {
  const { prisma } = require("../database");
  await prisma.user.delete({ where: { id: userId } });
  return { success: true };
};
