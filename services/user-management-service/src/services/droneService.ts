import { createDroneDual } from "./dataSync";

export const createDrone = createDroneDual;
export const getDrones = async (options: any) => {
  const { prisma } = require("../database");
  const drones = await prisma.drone.findMany();
  return { drones, totalCount: drones.length, pages: 1, currentPage: 1 };
};
export const getDroneById = async (droneId: string) => {
  const { prisma } = require("../database");
  return await prisma.drone.findUnique({ where: { id: droneId } });
};
export const updateDrone = async (droneId: string, updateData: any) => {
  const { prisma } = require("../database");
  return await prisma.drone.update({ where: { id: droneId }, data: updateData });
};
export const deleteDrone = async (droneId: string) => {
  const { prisma } = require("../database");
  await prisma.drone.delete({ where: { id: droneId } });
  return { success: true };
};