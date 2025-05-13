import blessed from 'blessed';
import { logger } from './logger';

// Terminal UI screen
let screen: blessed.Widgets.Screen | null = null;
let boxes: { [key: string]: blessed.Widgets.BoxElement } = {};
let lists: { [key: string]: blessed.Widgets.ListElement } = {};

// Initialize the terminal UI
export const initTerminalUI = () => {
  try {
    // Create a screen object
    screen = blessed.screen({
      smartCSR: true,
      title: 'FlyOS Mock Data Creator'
    });

    // Handle exit
    screen.key(['escape', 'q', 'C-c'], () => {
      return process.exit(0);
    });

    // Create header box
    boxes.header = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: ' FlyOS System Performance Test',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: 'white'
        }
      }
    });

    // Create drone status box
    boxes.droneStatus = blessed.box({
      top: 3,
      left: 0,
      width: '100%',
      height: 3,
      content: ' Active Drones: 0',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'white'
        }
      }
    });

    // Create latency stats box
    boxes.latencyStats = blessed.box({
      top: 6,
      left: 0,
      width: '100%',
      height: 8,
      content: ' Operation Latency Statistics',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'white'
        }
      }
    });

    // Create throughput box
    boxes.throughput = blessed.box({
      top: 14,
      left: 0,
      width: '100%',
      height: 3,
      content: ' System Throughput: 0 operations/second',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'white'
        }
      }
    });

    // Create events list
    lists.events = blessed.list({
      top: 17,
      left: 0,
      width: '100%',
      height: '100%-17',
      content: ' Recent Events',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'white'
        },
        selected: {
          bg: 'blue'
        }
      },
      items: []
    });

    // Add all elements to the screen
    Object.values(boxes).forEach(box => screen?.append(box));
    Object.values(lists).forEach(list => screen?.append(list));

    // Render the screen
    screen.render();

    return { screen, boxes, lists };
  } catch (error) {
    logger.error('Failed to initialize terminal UI:', error);
    return null;
  }
};

// Update the header with runtime info
export const updateHeader = (runTime: string) => {
  if (!screen || !boxes.header) return;
  
  boxes.header.setContent(` FlyOS System Performance Test                   Runtime: ${runTime}`);
  screen.render();
};

// Update drone status
export const updateDroneStatus = (activeDrones: number, targetDrones: number) => {
  if (!screen || !boxes.droneStatus) return;
  
  // Create a visual representation of drones
  const droneVisual = '⬤'.repeat(Math.min(activeDrones, 20));
  
  boxes.droneStatus.setContent(` Active Drones: ${activeDrones} ${droneVisual}                 Target: ${targetDrones}`);
  screen.render();
};

// Update latency statistics
export const updateLatencyStats = (stats: {
  operation: string;
  avgLatency: number;
  p95Latency: number;
  errorRate: number;
}[]) => {
  if (!screen || !boxes.latencyStats) return;
  
  let content = ' Operation      Avg Latency     95th %ile      Error Rate\n';
  content += ' ───────────────────────────────────────────────────────\n';
  
  stats.forEach(stat => {
    content += ` ${stat.operation.padEnd(14)} ${stat.avgLatency.toFixed(1).padStart(8)} ms     ${stat.p95Latency.toFixed(1).padStart(8)} ms     ${stat.errorRate.toFixed(2).padStart(5)}%\n`;
  });
  
  boxes.latencyStats.setContent(content);
  screen.render();
};

// Update throughput
export const updateThroughput = (opsPerSecond: number) => {
  if (!screen || !boxes.throughput) return;
  
  boxes.throughput.setContent(` System Throughput: ${opsPerSecond.toFixed(0)} operations/second`);
  screen.render();
};

// Add an event to the events list
export const addEvent = (event: string) => {
  if (!screen || !lists.events) return;
  
  const timestamp = new Date().toLocaleTimeString();
  (lists.events as any).addItem(`[${timestamp}] ${event}`);
  
  // Keep only the last 100 events
  if ((lists.events as any).items?.length > 100) {
    (lists.events as any).removeItem(0);
  }
  
  // Scroll to bottom
  lists.events.scrollTo((lists.events as any).items?.length || 0);
  
  screen.render();
};

// Clean up the terminal UI
export const cleanupTerminalUI = () => {
  if (!screen) return;
  
  screen.destroy();
};