// components/DroneControl/ParameterManager/parameterData.ts
import { ParameterCategory } from './types';

// This file will contain all 1000+ ArduPilot parameters organized by category
// For now, this is a structured template - replace with actual data from Google AI Studio

export const PARAMETER_CATEGORIES: ParameterCategory[] = [
  {
    name: "Flight Control & Navigation",
    description: "Core flight control, PIDs, and navigation systems",
    expanded: false,
    subcategories: [
      {
        name: "Attitude Control (PIDs)",
        description: "Roll, Pitch, Yaw rate and angle control parameters",
        expanded: false,
        parameters: [
          // Rate Controllers
          { name: "ATC_RAT_RLL_P", value: 0.135, description: "Roll rate controller P gain", type: "FLOAT", range: [0.01, 0.5], default: 0.135, unit: "" },
          { name: "ATC_RAT_RLL_I", value: 0.135, description: "Roll rate controller I gain", type: "FLOAT", range: [0.01, 2.0], default: 0.135, unit: "" },
          { name: "ATC_RAT_RLL_D", value: 0.0036, description: "Roll rate controller D gain", type: "FLOAT", range: [0.000, 0.02], default: 0.0036, unit: "" },
          { name: "ATC_RAT_RLL_FF", value: 0, description: "Roll rate controller feed forward", type: "FLOAT", range: [0, 0.5], default: 0, unit: "" },
          { name: "ATC_RAT_RLL_FLTT", value: 20, description: "Roll rate controller target frequency in Hz", type: "FLOAT", range: [1, 50], default: 20, unit: "Hz" },
          { name: "ATC_RAT_RLL_FLTE", value: 2.5, description: "Roll rate controller error frequency in Hz", type: "FLOAT", range: [1, 100], default: 2.5, unit: "Hz" },
          { name: "ATC_RAT_RLL_FLTD", value: 7.5, description: "Roll rate controller derivative frequency in Hz", type: "FLOAT", range: [1, 100], default: 7.5, unit: "Hz" },
          { name: "ATC_RAT_RLL_SMAX", value: 0, description: "Roll slew rate limit", type: "FLOAT", range: [0, 200], default: 0, unit: "deg/s/s" },
          
          { name: "ATC_RAT_PIT_P", value: 0.135, description: "Pitch rate controller P gain", type: "FLOAT", range: [0.01, 0.5], default: 0.135, unit: "" },
          { name: "ATC_RAT_PIT_I", value: 0.135, description: "Pitch rate controller I gain", type: "FLOAT", range: [0.01, 2.0], default: 0.135, unit: "" },
          { name: "ATC_RAT_PIT_D", value: 0.0036, description: "Pitch rate controller D gain", type: "FLOAT", range: [0.000, 0.02], default: 0.0036, unit: "" },
          { name: "ATC_RAT_PIT_FF", value: 0, description: "Pitch rate controller feed forward", type: "FLOAT", range: [0, 0.5], default: 0, unit: "" },
          { name: "ATC_RAT_PIT_FLTT", value: 20, description: "Pitch rate controller target frequency in Hz", type: "FLOAT", range: [1, 50], default: 20, unit: "Hz" },
          { name: "ATC_RAT_PIT_FLTE", value: 2.5, description: "Pitch rate controller error frequency in Hz", type: "FLOAT", range: [1, 100], default: 2.5, unit: "Hz" },
          { name: "ATC_RAT_PIT_FLTD", value: 7.5, description: "Pitch rate controller derivative frequency in Hz", type: "FLOAT", range: [1, 100], default: 7.5, unit: "Hz" },
          { name: "ATC_RAT_PIT_SMAX", value: 0, description: "Pitch slew rate limit", type: "FLOAT", range: [0, 200], default: 0, unit: "deg/s/s" },
          
          { name: "ATC_RAT_YAW_P", value: 0.18, description: "Yaw rate controller P gain", type: "FLOAT", range: [0.01, 0.5], default: 0.18, unit: "" },
          { name: "ATC_RAT_YAW_I", value: 0.02, description: "Yaw rate controller I gain", type: "FLOAT", range: [0.01, 0.1], default: 0.02, unit: "" },
          { name: "ATC_RAT_YAW_D", value: 0.003, description: "Yaw rate controller D gain", type: "FLOAT", range: [0.000, 0.02], default: 0.003, unit: "" },
          { name: "ATC_RAT_YAW_FF", value: 0, description: "Yaw rate controller feed forward", type: "FLOAT", range: [0, 0.5], default: 0, unit: "" },
          { name: "ATC_RAT_YAW_FLTT", value: 2.5, description: "Yaw rate controller target frequency in Hz", type: "FLOAT", range: [1, 50], default: 2.5, unit: "Hz" },
          { name: "ATC_RAT_YAW_FLTE", value: 0, description: "Yaw rate controller error frequency in Hz", type: "FLOAT", range: [0, 100], default: 0, unit: "Hz" },
          { name: "ATC_RAT_YAW_FLTD", value: 7.5, description: "Yaw rate controller derivative frequency in Hz", type: "FLOAT", range: [1, 100], default: 7.5, unit: "Hz" },
          { name: "ATC_RAT_YAW_SMAX", value: 0, description: "Yaw slew rate limit", type: "FLOAT", range: [0, 200], default: 0, unit: "deg/s/s" },
          
          // Angle Controllers
          { name: "ATC_ANG_RLL_P", value: 4.5, description: "Roll angle controller P gain", type: "FLOAT", range: [3.000, 25.000], default: 4.5, unit: "" },
          { name: "ATC_ANG_PIT_P", value: 4.5, description: "Pitch angle controller P gain", type: "FLOAT", range: [3.000, 25.000], default: 4.5, unit: "" },
          { name: "ATC_ANG_YAW_P", value: 4.5, description: "Yaw angle controller P gain", type: "FLOAT", range: [3.000, 25.000], default: 4.5, unit: "" }
        ]
      },
      {
        name: "Position Control",
        description: "Horizontal and vertical position control parameters",
        expanded: false,
        parameters: [
          // Position Control
          { name: "PSC_POSXY_P", value: 1, description: "Position control P gain", type: "FLOAT", range: [0.5, 2.0], default: 1, unit: "" },
          { name: "PSC_POSZ_P", value: 1, description: "Position control Z P gain", type: "FLOAT", range: [0.5, 3.0], default: 1, unit: "" },
          
          // Velocity Control
          { name: "PSC_VELXY_P", value: 2, description: "Velocity (horizontal) P gain", type: "FLOAT", range: [0.1, 6.0], default: 2, unit: "" },
          { name: "PSC_VELXY_I", value: 1, description: "Velocity (horizontal) I gain", type: "FLOAT", range: [0.02, 3.0], default: 1, unit: "" },
          { name: "PSC_VELXY_D", value: 0.5, description: "Velocity (horizontal) D gain", type: "FLOAT", range: [0.00, 1.0], default: 0.5, unit: "" },
          { name: "PSC_VELXY_IMAX", value: 1000, description: "Velocity (horizontal) integrator maximum", type: "FLOAT", range: [0, 4500], default: 1000, unit: "cm/s" },
          { name: "PSC_VELXY_FLTE", value: 5, description: "Velocity (horizontal) error filter", type: "FLOAT", range: [1, 100], default: 5, unit: "Hz" },
          { name: "PSC_VELXY_FLTD", value: 5, description: "Velocity (horizontal) derivative filter", type: "FLOAT", range: [1, 100], default: 5, unit: "Hz" },
          
          { name: "PSC_VELZ_P", value: 5, description: "Velocity (vertical) P gain", type: "FLOAT", range: [1.000, 8.000], default: 5, unit: "" },
          { name: "PSC_VELZ_I", value: 10, description: "Velocity (vertical) I gain", type: "FLOAT", range: [0.02, 25.0], default: 10, unit: "" },
          { name: "PSC_VELZ_D", value: 0, description: "Velocity (vertical) D gain", type: "FLOAT", range: [0.00, 1.0], default: 0, unit: "" },
          { name: "PSC_VELZ_IMAX", value: 800, description: "Velocity (vertical) integrator maximum", type: "FLOAT", range: [0, 1000], default: 800, unit: "cm/s" },
          { name: "PSC_VELZ_FLTE", value: 5, description: "Velocity (vertical) error filter", type: "FLOAT", range: [1, 100], default: 5, unit: "Hz" },
          { name: "PSC_VELZ_FLTD", value: 5, description: "Velocity (vertical) derivative filter", type: "FLOAT", range: [1, 100], default: 5, unit: "Hz" },
          
          // Acceleration Control
          { name: "PSC_ACCZ_P", value: 0.5, description: "Acceleration (vertical) controller P gain", type: "FLOAT", range: [0.200, 1.500], default: 0.5, unit: "" },
          { name: "PSC_ACCZ_I", value: 1, description: "Acceleration (vertical) controller I gain", type: "FLOAT", range: [0.01, 3.0], default: 1, unit: "" },
          { name: "PSC_ACCZ_D", value: 0, description: "Acceleration (vertical) controller D gain", type: "FLOAT", range: [0.000, 0.400], default: 0, unit: "" },
          { name: "PSC_ACCZ_IMAX", value: 800, description: "Acceleration (vertical) controller I gain maximum", type: "FLOAT", range: [0, 1000], default: 800, unit: "cm/s/s" },
          { name: "PSC_ACCZ_FLTD", value: 0, description: "Acceleration (vertical) controller derivative frequency in Hz", type: "FLOAT", range: [0, 100], default: 0, unit: "Hz" },
          { name: "PSC_ACCZ_FLTT", value: 0, description: "Acceleration (vertical) controller target frequency in Hz", type: "FLOAT", range: [0, 100], default: 0, unit: "Hz" },
          { name: "PSC_ACCZ_FLTE", value: 20, description: "Acceleration (vertical) controller error frequency in Hz", type: "FLOAT", range: [1, 100], default: 20, unit: "Hz" },
          { name: "PSC_ACCZ_SMAX", value: 0, description: "Accel (vertical) slew rate limit", type: "FLOAT", range: [0, 500], default: 0, unit: "cm/s/s/s" }
        ]
      },
      {
        name: "Navigation & Waypoints",
        description: "Autonomous navigation and waypoint following",
        expanded: false,
        parameters: [
          { name: "WPNAV_SPEED", value: 500, description: "Waypoint Horizontal Speed Target", type: "FLOAT", range: [20, 2000], default: 500, unit: "cm/s" },
          { name: "WPNAV_RADIUS", value: 200, description: "Waypoint Radius", type: "FLOAT", range: [5, 1000], default: 200, unit: "cm" },
          { name: "WPNAV_SPEED_UP", value: 250, description: "Waypoint Climb Speed Target", type: "FLOAT", range: [10, 1000], default: 250, unit: "cm/s" },
          { name: "WPNAV_SPEED_DN", value: 150, description: "Waypoint Descent Speed Target", type: "FLOAT", range: [10, 500], default: 150, unit: "cm/s" },
          { name: "WPNAV_ACCEL", value: 100, description: "Waypoint Acceleration", type: "FLOAT", range: [50, 500], default: 100, unit: "cm/s/s" },
          { name: "WPNAV_ACCEL_Z", value: 100, description: "Waypoint Vertical Acceleration", type: "FLOAT", range: [50, 500], default: 100, unit: "cm/s/s" },
          { name: "WPNAV_JERK", value: 1, description: "Waypoint Jerk", type: "FLOAT", range: [0.1, 20], default: 1, unit: "m/s/s/s" }
        ]
      },
      {
        name: "Landing & Precision Landing",
        description: "Auto-land and precision landing configuration",
        expanded: false,
        parameters: [
          { name: "LAND_SPEED", value: 50, description: "Land speed", type: "INT16", range: [30, 200], default: 50, unit: "cm/s" },
          { name: "LAND_SPEED_HIGH", value: 0, description: "Land speed high", type: "INT16", range: [0, 500], default: 0, unit: "cm/s" },
          { name: "LAND_ALT_LOW", value: 1000, description: "Land alt low", type: "FLOAT", range: [100, 10000], default: 1000, unit: "cm" },
          { name: "LAND_REPOSITION", value: 1, description: "Land repositioning", type: "INT8", range: [0, 1], default: 1, unit: "" },
          { name: "PLND_ENABLED", value: 0, description: "Precision Land enabled/disabled", type: "INT8", range: [0, 1], default: 0, unit: "" },
          { name: "PLND_TYPE", value: 0, description: "Precision Land Type", type: "INT8", range: [0, 4], default: 0, unit: "" },
          { name: "PLND_EST_TYPE", value: 0, description: "Precision Land Estimator Type", type: "INT8", range: [0, 1], default: 0, unit: "" },
          { name: "PLND_ACC_P_NSE", value: 0.5, description: "Precision Land Accelerometer Noise", type: "FLOAT", range: [0.1, 2.0], default: 0.5, unit: "m/s/s" }
        ]
      },
      {
        name: "Circle & Loiter",
        description: "Circle mode and loiter behavior parameters",
        expanded: false,
        parameters: [
          { name: "CIRCLE_RADIUS", value: 1000, description: "Circle Radius", type: "FLOAT", range: [0, 10000], default: 1000, unit: "cm" },
          { name: "CIRCLE_RATE", value: 20, description: "Circle rate", type: "FLOAT", range: [-90, 90], default: 20, unit: "deg/s" },
          { name: "LOIT_SPEED", value: 1250, description: "Loiter maximum speed", type: "FLOAT", range: [20, 3500], default: 1250, unit: "cm/s" },
          { name: "LOIT_BRK_ACCEL", value: 250, description: "Loiter braking acceleration", type: "FLOAT", range: [25, 750], default: 250, unit: "cm/s/s" },
          { name: "LOIT_BRK_JERK", value: 500, description: "Loiter braking jerk", type: "FLOAT", range: [250, 2000], default: 500, unit: "cm/s/s/s" },
          { name: "LOIT_BRK_DELAY", value: 1, description: "Loiter brake start delay (in seconds)", type: "FLOAT", range: [0, 2], default: 1, unit: "s" },
          { name: "LOIT_ACC_MAX", value: 500, description: "Loiter maximum correction acceleration", type: "FLOAT", range: [100, 981], default: 500, unit: "cm/s/s" }
        ]
      }
    ]
  },
  {
    name: "Sensors & Estimation",
    description: "IMU, GPS, compass and sensor fusion parameters",
    expanded: false,
    subcategories: [
      {
        name: "GPS / GNSS",
        description: "GPS configuration and positioning parameters",
        expanded: false,
        parameters: [
          { name: "GPS_TYPE", value: 1, description: "GPS type", type: "INT8", range: [0, 22], default: 1, unit: "" },
          { name: "GPS_TYPE2", value: 0, description: "2nd GPS type", type: "INT8", range: [0, 22], default: 0, unit: "" },
          { name: "GPS_NAVFILTER", value: 8, description: "Navigation filter setting", type: "INT8", range: [0, 8], default: 8, unit: "" },
          { name: "GPS_AUTO_SWITCH", value: 1, description: "Automatic Switchover Setting", type: "INT8", range: [0, 4], default: 1, unit: "" },
          { name: "GPS_MIN_DGPS", value: 100, description: "Minimum Lock Type Accepted for DGPS", type: "INT8", range: [0, 4], default: 100, unit: "" },
          { name: "GPS_SBAS_MODE", value: 2, description: "SBAS Mode", type: "INT8", range: [0, 6], default: 2, unit: "" },
          { name: "GPS_MIN_ELEV", value: -100, description: "Minimum elevation", type: "INT8", range: [-90, 90], default: -100, unit: "deg" },
          { name: "GPS_INJECT_TO", value: 127, description: "Destination for GPS_INJECT_DATA MAVLink packets", type: "INT8", range: [0, 127], default: 127, unit: "" },
          { name: "GPS_SBP_LOGMASK", value: -256, description: "Swift Binary Protocol Logging Mask", type: "INT16", range: [0, 65535], default: -256, unit: "" },
          { name: "GPS_RAW_DATA", value: 0, description: "Raw data logging", type: "INT8", range: [0, 2], default: 0, unit: "" },
          { name: "GPS_GNSS_MODE", value: 0, description: "GNSS system configuration", type: "INT8", range: [0, 7], default: 0, unit: "" },
          { name: "GPS_SAVE_CFG", value: 2, description: "Save GPS configuration", type: "INT8", range: [0, 4], default: 2, unit: "" },
          { name: "GPS_GNSS_MODE2", value: 0, description: "GNSS system configuration", type: "INT8", range: [0, 7], default: 0, unit: "" },
          { name: "GPS_AUTO_CONFIG", value: 1, description: "Automatic GPS configuration", type: "INT8", range: [0, 2], default: 1, unit: "" },
          { name: "GPS_RATE_MS", value: 200, description: "GPS update rate in milliseconds", type: "INT16", range: [50, 200], default: 200, unit: "ms" },
          { name: "GPS_RATE_MS2", value: 200, description: "GPS 2 update rate in milliseconds", type: "INT16", range: [50, 200], default: 200, unit: "ms" },
          { name: "GPS_POS1_X", value: 0, description: "Antenna X position offset", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "GPS_POS1_Y", value: 0, description: "Antenna Y position offset", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "GPS_POS1_Z", value: 0, description: "Antenna Z position offset", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "GPS_POS2_X", value: 0, description: "Antenna X position offset", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "GPS_POS2_Y", value: 0, description: "Antenna Y position offset", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "GPS_POS2_Z", value: 0, description: "Antenna Z position offset", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "GPS_DELAY_MS", value: 220, description: "GPS delay in milliseconds", type: "INT16", range: [0, 1000], default: 220, unit: "ms" },
          { name: "GPS_DELAY_MS2", value: 220, description: "GPS 2 delay in milliseconds", type: "INT16", range: [0, 1000], default: 220, unit: "ms" },
          { name: "GPS_BLEND_MASK", value: 5, description: "Multi GPS Blending Mask", type: "INT8", range: [0, 7], default: 5, unit: "" },
          { name: "GPS_BLEND_TC", value: 10, description: "Blending time constant", type: "FLOAT", range: [5, 30], default: 10, unit: "s" },
          { name: "GPS_DRV_OPTIONS", value: 0, description: "driver options", type: "INT16", range: [0, 255], default: 0, unit: "" },
          { name: "GPS_COM_PORT", value: 5, description: "GPS physical COM port", type: "INT8", range: [-1, 10], default: 5, unit: "" },
          { name: "GPS_COM_PORT2", value: -1, description: "GPS physical COM port", type: "INT8", range: [-1, 10], default: -1, unit: "" },
          { name: "GPS_PRIMARY", value: 0, description: "Primary GPS", type: "INT8", range: [0, 1], default: 0, unit: "" },
          { name: "GPS_CAN_NODEID1", value: -1, description: "GPS Node ID 1", type: "INT8", range: [-1, 250], default: -1, unit: "" },
          { name: "GPS_CAN_NODEID2", value: -1, description: "GPS Node ID 2", type: "INT8", range: [-1, 250], default: -1, unit: "" }
        ]
      },
      {
        name: "IMU (Accelerometer & Gyroscope)",
        description: "Inertial measurement unit configuration",
        expanded: false,
        parameters: [
          { name: "INS_GYRO_FILTER", value: 20, description: "Gyro filter cutoff frequency", type: "INT8", range: [0, 256], default: 20, unit: "Hz" },
          { name: "INS_ACCEL_FILTER", value: 20, description: "Accel filter cutoff frequency", type: "INT8", range: [0, 256], default: 20, unit: "Hz" },
          { name: "INS_USE", value: 1, description: "Use first IMU for attitude, velocity and position estimates", type: "INT8", range: [0, 1], default: 1, unit: "" },
          { name: "INS_USE2", value: 1, description: "Use second IMU for attitude, velocity and position estimates", type: "INT8", range: [0, 1], default: 1, unit: "" },
          { name: "INS_USE3", value: 1, description: "Use third IMU for attitude, velocity and position estimates", type: "INT8", range: [0, 1], default: 1, unit: "" },
          { name: "INS_STILL_THRESH", value: 0.1, description: "Stillness threshold for detecting if we are moving", type: "FLOAT", range: [0.05, 1.0], default: 0.1, unit: "m/s" },
          { name: "INS_GYR_CAL", value: 1, description: "Gyro Calibration scheme", type: "INT8", range: [0, 3], default: 1, unit: "" },
          { name: "INS_TRIM_OPTION", value: 1, description: "Accel cal trim option", type: "INT8", range: [0, 2], default: 1, unit: "" },
          { name: "INS_ACC_BODYFIX", value: 2, description: "Body-fixed accelerometer", type: "INT8", range: [1, 3], default: 2, unit: "" },
          { name: "INS_POS1_X", value: 0, description: "IMU accelerometer X position", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "INS_POS1_Y", value: 0, description: "IMU accelerometer Y position", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "INS_POS1_Z", value: 0, description: "IMU accelerometer Z position", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "INS_POS2_X", value: 0, description: "IMU accelerometer X position", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "INS_POS2_Y", value: 0, description: "IMU accelerometer Y position", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "INS_POS2_Z", value: 0, description: "IMU accelerometer Z position", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "INS_POS3_X", value: 0, description: "IMU accelerometer X position", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "INS_POS3_Y", value: 0, description: "IMU accelerometer Y position", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "INS_POS3_Z", value: 0, description: "IMU accelerometer Z position", type: "FLOAT", range: [-5, 5], default: 0, unit: "m" },
          { name: "INS_GYR_ID", value: 0, description: "Gyro ID", type: "INT32", range: [0, 16777215], default: 0, unit: "" },
          { name: "INS_GYR2_ID", value: 0, description: "Gyro2 ID", type: "INT32", range: [0, 16777215], default: 0, unit: "" },
          { name: "INS_GYR3_ID", value: 0, description: "Gyro3 ID", type: "INT32", range: [0, 16777215], default: 0, unit: "" },
          { name: "INS_ACC_ID", value: 0, description: "Accelerometer ID", type: "INT32", range: [0, 16777215], default: 0, unit: "" },
          { name: "INS_ACC2_ID", value: 0, description: "Accelerometer2 ID", type: "INT32", range: [0, 16777215], default: 0, unit: "" },
          { name: "INS_ACC3_ID", value: 0, description: "Accelerometer3 ID", type: "INT32", range: [0, 16777215], default: 0, unit: "" },
          { name: "INS_FAST_SAMPLE", value: 0, description: "Fast sampling mask", type: "INT8", range: [0, 7], default: 0, unit: "" },
          { name: "INS_ENABLE_MASK", value: 127, description: "IMU enable mask", type: "INT8", range: [1, 127], default: 127, unit: "" },
          { name: "INS_GYRO_RATE", value: 0, description: "Gyro rate for IMUs with Fast Sampling enabled", type: "INT8", range: [0, 8], default: 0, unit: "" },
          { name: "INS_ACC1_CALTEMP", value: -300, description: "Calibration temperature for 1st accelerometer", type: "FLOAT", range: [-300, 80], default: -300, unit: "degC" },
          { name: "INS_GYR1_CALTEMP", value: -300, description: "Calibration temperature for 1st gyroscope", type: "FLOAT", range: [-300, 80], default: -300, unit: "degC" },
          { name: "INS_ACC2_CALTEMP", value: -300, description: "Calibration temperature for 2nd accelerometer", type: "FLOAT", range: [-300, 80], default: -300, unit: "degC" },
          { name: "INS_GYR2_CALTEMP", value: -300, description: "Calibration temperature for 2nd gyroscope", type: "FLOAT", range: [-300, 80], default: -300, unit: "degC" },
          { name: "INS_ACC3_CALTEMP", value: -300, description: "Calibration temperature for 3rd accelerometer", type: "FLOAT", range: [-300, 80], default: -300, unit: "degC" },
          { name: "INS_GYR3_CALTEMP", value: -300, description: "Calibration temperature for 3rd gyroscope", type: "FLOAT", range: [-300, 80], default: -300, unit: "degC" },
          { name: "INS_TCAL_OPTIONS", value: 0, description: "Options for temperature calibration", type: "INT8", range: [0, 1], default: 0, unit: "" },
          { name: "INS_LOG_BAT_CNT", value: 1024, description: "sample count per batch", type: "INT16", range: [0, 32000], default: 1024, unit: "" },
          { name: "INS_LOG_BAT_MASK", value: 0, description: "Sensor Bitmask", type: "INT16", range: [0, 65535], default: 0, unit: "" },
          { name: "INS_LOG_BAT_OPT", value: 0, description: "Batch Logging Options Mask", type: "INT16", range: [0, 65535], default: 0, unit: "" },
          { name: "INS_LOG_BAT_LGIN", value: 20, description: "logging interval", type: "INT16", range: [10, 1000], default: 20, unit: "ms" },
          { name: "INS_LOG_BAT_LGCT", value: 32, description: "logging count", type: "INT16", range: [0, 65535], default: 32, unit: "" }
        ]
      },
      {
        name: "Compass / Magnetometer",
        description: "Compass configuration and calibration",
        expanded: false,
        parameters: [
          { name: "COMPASS_USE", value: 1, description: "Use compass for yaw", type: "INT8", range: [0, 1], default: 1, unit: "" },
          { name: "COMPASS_USE2", value: 1, description: "Use compass for yaw", type: "INT8", range: [0, 1], default: 1, unit: "" },
          { name: "COMPASS_USE3", value: 1, description: "Use compass for yaw", type: "INT8", range: [0, 1], default: 1, unit: "" },
          { name: "COMPASS_AUTODEC", value: 1, description: "Auto Declination", type: "INT8", range: [0, 1], default: 1, unit: "" },
          { name: "COMPASS_MOTCT", value: 0, description: "Motor interference compensation type", type: "INT8", range: [0, 3], default: 0, unit: "" },
          { name: "COMPASS_MOT_X", value: 0, description: "Motor interference compensation for body frame X axis", type: "FLOAT", range: [-1000, 1000], default: 0, unit: "" },
          { name: "COMPASS_MOT_Y", value: 0, description: "Motor interference compensation for body frame Y axis", type: "FLOAT", range: [-1000, 1000], default: 0, unit: "" },
          { name: "COMPASS_MOT_Z", value: 0, description: "Motor interference compensation for body frame Z axis", type: "FLOAT", range: [-1000, 1000], default: 0, unit: "" },
          { name: "COMPASS_ORIENT", value: 0, description: "Compass orientation", type: "INT8", range: [0, 38], default: 0, unit: "" },
          { name: "COMPASS_EXTERNAL", value: 0, description: "Compass is attached via an external cable", type: "INT8", range: [0, 1], default: 0, unit: "" },
          { name: "COMPASS_OFS_X", value: 0, description: "Compass offsets in milligauss on the X axis", type: "FLOAT", range: [-400, 400], default: 0, unit: "milligauss" },
          { name: "COMPASS_OFS_Y", value: 0, description: "Compass offsets in milligauss on the Y axis", type: "FLOAT", range: [-400, 400], default: 0, unit: "milligauss" },
          { name: "COMPASS_OFS_Z", value: 0, description: "Compass offsets in milligauss on the Z axis", type: "FLOAT", range: [-400, 400], default: 0, unit: "milligauss" },
          { name: "COMPASS_DIA_X", value: 1, description: "Compass soft-iron diagonal X component", type: "FLOAT", range: [0.8, 1.2], default: 1, unit: "" },
          { name: "COMPASS_DIA_Y", value: 1, description: "Compass soft-iron diagonal Y component", type: "FLOAT", range: [0.8, 1.2], default: 1, unit: "" },
          { name: "COMPASS_DIA_Z", value: 1, description: "Compass soft-iron diagonal Z component", type: "FLOAT", range: [0.8, 1.2], default: 1, unit: "" },
          { name: "COMPASS_ODI_X", value: 0, description: "Compass soft-iron off-diagonal X component", type: "FLOAT", range: [-0.2, 0.2], default: 0, unit: "" },
          { name: "COMPASS_ODI_Y", value: 0, description: "Compass soft-iron off-diagonal Y component", type: "FLOAT", range: [-0.2, 0.2], default: 0, unit: "" },
          { name: "COMPASS_ODI_Z", value: 0, description: "Compass soft-iron off-diagonal Z component", type: "FLOAT", range: [-0.2, 0.2], default: 0, unit: "" }
        ]
      },
      {
        name: "Barometer",
        description: "Barometric pressure sensor configuration",
        expanded: false,
        parameters: [
          { name: "BARO_PRIMARY", value: 0, description: "Primary barometer", type: "INT8", range: [0, 3], default: 0, unit: "" },
          { name: "BARO_EXT_BUS", value: -1, description: "External baro bus", type: "INT8", range: [-1, 3], default: -1, unit: "" },
          { name: "BARO_SPEC_GRAV", value: 9.80665, description: "Specific Gravity (gravity)", type: "FLOAT", range: [9.7, 9.9], default: 9.80665, unit: "m/s/s" },
          { name: "BARO_ABS_PRESS", value: 0, description: "Absolute Pressure", type: "FLOAT", range: [0, 200000], default: 0, unit: "Pa" },
          { name: "BARO_TEMP", value: 0, description: "ground temperature", type: "FLOAT", range: [-50, 80], default: 0, unit: "degC" },
          { name: "BARO_ALT_OFFSET", value: 0, description: "altitude offset", type: "FLOAT", range: [-32767, 32767], default: 0, unit: "m" },
          { name: "BARO_OPTIONS", value: 0, description: "Barometer options", type: "INT16", range: [0, 65535], default: 0, unit: "" },
          { name: "BARO_FLTR_RNG", value: 0.2, description: "Range in which sample is accepted", type: "FLOAT", range: [0, 1], default: 0.2, unit: "" }
        ]
      },
      {
        name: "Rangefinder",
        description: "Distance sensor and rangefinder settings",
        expanded: false,
        parameters: [
          { name: "RNGFND1_TYPE", value: 0, description: "Rangefinder type", type: "INT8", range: [0, 35], default: 0, unit: "" },
          { name: "RNGFND1_PIN", value: -1, description: "Rangefinder pin", type: "INT8", range: [-1, 15], default: -1, unit: "" },
          { name: "RNGFND1_SCALING", value: 3, description: "Rangefinder scaling", type: "FLOAT", range: [0, 127], default: 3, unit: "" },
          { name: "RNGFND1_OFFSET", value: 0, description: "rangefinder offset", type: "FLOAT", range: [0, 127], default: 0, unit: "cm" },
          { name: "RNGFND1_FUNCTION", value: 0, description: "Rangefinder function", type: "INT8", range: [0, 1], default: 0, unit: "" },
          { name: "RNGFND1_MIN_CM", value: 20, description: "Rangefinder minimum distance", type: "INT16", range: [0, 32767], default: 20, unit: "cm" },
          { name: "RNGFND1_MAX_CM", value: 700, description: "Rangefinder maximum distance", type: "INT16", range: [0, 32767], default: 700, unit: "cm" },
          { name: "RNGFND1_STOP_PIN", value: -1, description: "Rangefinder stop pin", type: "INT8", range: [-1, 15], default: -1, unit: "" },
          { name: "RNGFND1_SETTLE", value: 0, description: "Rangefinder settle time", type: "INT16", range: [0, 32767], default: 0, unit: "ms" },
          { name: "RNGFND1_RMETRIC", value: 1, description: "Ratiometric", type: "INT8", range: [0, 1], default: 1, unit: "" },
          { name: "
