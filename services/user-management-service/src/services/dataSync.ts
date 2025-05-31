
import { prisma } from "../database";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// DUAL WRITE: Create in both databases
export const createUserDual = async (userData: any) => {
  const localUser = await prisma.user.create({
    data: {
      username: userData.username,
      fullName: userData.fullName,
      email: userData.email,
      role: userData.role,
      regionId: userData.regionId || null,
      status: userData.status || "ACTIVE",
      supabaseUserId: null
    }
  });

  // Immediate Supabase sync
  await supabase.from("profiles").insert({
    id: localUser.id,
    username: localUser.username,
    full_name: localUser.fullName,
    email: localUser.email,
    role: localUser.role,
    region_id: localUser.regionId,
    status: localUser.status
  });

  return localUser;
};

export const createRegionDual = async (regionData: any) => {
  const localRegion = await prisma.region.create({
    data: {
      name: regionData.name,
      area: regionData.area,
      commanderName: regionData.commanderName || null,
      status: regionData.status || "ACTIVE"
    }
  });

  await supabase.from("regions").insert({
    id: localRegion.id,
    name: localRegion.name,
    area: localRegion.area,
    commander_name: localRegion.commanderName,
    status: localRegion.status
  });

  return localRegion;
};

export const createDroneDual = async (droneData: any) => {
  const localDrone = await prisma.drone.create({
    data: {
      id: droneData.id,
      model: droneData.model,
      status: droneData.status || "STANDBY",
      regionId: droneData.regionId || null,
      operatorId: droneData.operatorId || null
    }
  });

  await supabase.from("drones").insert({
    id: localDrone.id,
    model: localDrone.model,
    status: localDrone.status,
    region_id: localDrone.regionId,
    operator_id: localDrone.operatorId
  });

  return localDrone;
};

// STARTUP: Load from Supabase if local empty
export const initializeData = async () => {
  const localCount = await prisma.user.count();
  
  if (localCount === 0) {
    logger.info("Loading from Supabase...");
    
    const [users, regions, drones] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("regions").select("*"),
      supabase.from("drones").select("*")
    ]);

    // Restore data
    for (const user of users.data || []) {
      await prisma.user.create({
        data: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          regionId: user.region_id,
          status: user.status,
          supabaseUserId: null
        }
      });
    }

    for (const region of regions.data || []) {
      await prisma.region.create({
        data: {
          id: region.id,
          name: region.name,
          area: region.area,
          commanderName: region.commander_name,
          status: region.status
        }
      });
    }

    for (const drone of drones.data || []) {
      await prisma.drone.create({
        data: {
          id: drone.id,
          model: drone.model,
          status: drone.status,
          regionId: drone.region_id,
          operatorId: drone.operator_id
        }
      });
    }
  }
};
