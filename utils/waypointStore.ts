// utils/waypointStore.ts
export interface Waypoint {
  seq: number;
  lat: number;
  lng: number;
  alt: number;
}

class WaypointStore {
  private listeners: Set<(waypoints: Waypoint[]) => void>;
  private waypoints: Waypoint[];

  constructor() {
    this.listeners = new Set();
    this.waypoints = [];
  }

  setWaypoints(waypoints: Waypoint[]): void {
    this.waypoints = waypoints;
    this.notifyListeners();
  }

  getWaypoints(): Waypoint[] {
    return this.waypoints;
  }

  addListener(callback: (waypoints: Waypoint[]) => void): void {
    this.listeners.add(callback);
  }

  removeListener(callback: (waypoints: Waypoint[]) => void): void {
    this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.waypoints));
  }
}

export const waypointStore = new WaypointStore();
