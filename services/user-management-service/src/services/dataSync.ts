// services/user-management-service/src/services/dataSync.ts - FIXED VERSION
import { prisma } from "../database";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// FIXED: Link to existing Supabase Auth users instead of creating new ones
export const createUserDual = async (userData: any) => {
  try {
    logger.info(`Creating user: ${userData.username}`);

    // Step 1: Find existing Supabase Auth user by email
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Failed to check existing users: ${listError.message}`);
    }

    const existingAuthUser = existingUsers.users.find(u => u.email === userData.email);
    
    if (!existingAuthUser) {
      throw new Error(`Auth user ${userData.email} must be created in Supabase dashboard first`);
    }

    logger.info(`Found existing auth user: ${existingAuthUser.id}`);

    // Step 2: Update auth user metadata
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existingAuthUser.id,
      {
        user_metadata: {
          username: userData.username,
          role: userData.role,
          region_id: userData.regionId,
          full_name: userData.fullName
        }
      }
    );

    if (updateError) {
      logger.warn('Failed to update auth user metadata:', updateError);
    }

    // Step 3: Create in local PostgreSQL
    const localUser = await prisma.user.create({
      data: {
        username: userData.username,
        fullName: userData.fullName,
        email: userData.email,
        role: userData.role,
        regionId: userData.regionId || null,
        status: userData.status || "ACTIVE",
        supabaseUserId: existingAuthUser.id // Link to existing auth user
      }
    });

    // Step 4: Create in Supabase profiles table
    const { error: profileError } = await supabase.from("profiles").insert({
      id: localUser.id,
      username: localUser.username,
      full_name: localUser.fullName,
      email: localUser.email,
      role: localUser.role,
      region_id: localUser.regionId,
      status: localUser.status,
      supabase_user_id: existingAuthUser.id
    });

    if (profileError) {
      logger.error('Failed to create Supabase profile:', profileError);
      // Don't fail completely - local user exists
    }

    logger.info(`✅ User created successfully: ${userData.username} (Auth: ${existingAuthUser.id})`);
    return localUser;

  } catch (error: any) {
    logger.error('Failed to create user:', error);
    throw error;
  }
};

// Keep existing functions unchanged
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

export const initializeData = async () => {
  const localCount = await prisma.user.count();
  
  if (localCount === 0) {
    logger.info("Loading from Supabase...");
    
    const [users, regions, drones] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("regions").select("*"),
      supabase.from("drones").select("*")
    ]);

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
          supabaseUserId: user.supabase_user_id
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