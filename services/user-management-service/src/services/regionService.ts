import { createRegionDual } from "./dataSync";

export const createRegion = createRegionDual;
export const getRegions = async () => {
  const { prisma } = require("../database");
  return await prisma.region.findMany();
};
export const getRegionById = async (regionId: string) => {
  const { prisma } = require("../database");
  return await prisma.region.findUnique({ where: { id: regionId } });
};
export const updateRegion = async (regionId: string, updateData: any) => {
  const { prisma } = require("../database");
  return await prisma.region.update({ where: { id: regionId }, data: updateData });
};
export const deleteRegion = async (regionId: string) => {
  const { prisma } = require("../database");
  await prisma.region.delete({ where: { id: regionId } });
  return { success: true };
};