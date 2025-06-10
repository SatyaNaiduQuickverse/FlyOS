"use client";

// test-mission-pipeline.tsx - Frontend test component
import React, { useState } from 'react';
import { useAuth } from '../../../lib/auth';

interface TestResult {
  test: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: any;
}

const MissionPipelineTest: React.FC = () => {
  const { token } = useAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Test waypoint file content
  const testWaypointFile = `QGC WPL 110
0	1	0	16	0	0	0	0	18.5204	73.8567	100	1
1	0	0	16	0	0	0	0	18.5214	73.8577	100	1
2	0	0	16	0	0	0	0	18.5224	73.8587	100	1
3	0	0	16	0	0	0	0	18.5234	73.8597	100	1
4	0	0	16	0	0	0	0	18.5244	73.8607	100	1`;

  const parseWaypoints = (content: string) => {
    const lines = content.trim().split('\n');
    const waypoints = [];
    
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length >= 12) {
        waypoints.push({
          seq: parseInt(parts[0]),
          frame: parseInt(parts[2]),
          command: parseInt(parts[3]),
          param1: parseFloat(parts[4]),
          param2: parseFloat(parts[5]),
          param3: parseFloat(parts[6]),
          param4: parseFloat(parts[7]),
          lat: parseFloat(parts[8]),
          lng: parseFloat(parts[9]),
          alt: parseFloat(parts[10])
        });
      }
    }
    
    return waypoints;
  };

  const addResult = (test: string, status: TestResult['status'], message: string, details?: any) => {
    setResults(prev => [...prev, { test, status, message, details }]);
  };

  const updateResult = (index: number, status: TestResult['status'], message: string, details?: any) => {
    setResults(prev => prev.map((result, i) => 
      i === index ? { ...result, status, message, details } : result
    ));
  };

  const testWaypointUpload = async (droneId: string): Promise<string | null> => {
    const testIndex = results.length;
    addResult(`Upload waypoints to ${droneId}`, 'pending', 'Uploading...');
    
    try {
      const waypoints = parseWaypoints(testWaypointFile);
      
      const response = await fetch(`/api/drones/${droneId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          commandType: 'upload_waypoints',
          parameters: {
            waypoints,
            fileName: `test_waypoints_${droneId}.txt`,
            totalWaypoints: waypoints.length,
            uploadedBy: 'test_user',
            uploadedAt: new Date().toISOString()
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        updateResult(testIndex, 'success', `Uploaded ${waypoints.length} waypoints`, result);
        return result.missionId || result.commandId;
      } else {
        updateResult(testIndex, 'error', result.message || 'Upload failed', result);
        return null;
      }
    } catch (error) {
      updateResult(testIndex, 'error', `Network error: ${error}`, error);
      return null;
    }
  };

  const testMissionCommand = async (droneId: string, command: string, missionId: string) => {
    const testIndex = results.length;
    addResult(`${command} for ${droneId}`, 'pending', 'Sending command...');
    
    try {
      const response = await fetch(`/api/drones/${droneId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          commandType: command,
          parameters: { missionId }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        updateResult(testIndex, 'success', `${command} successful`, result);
      } else {
        updateResult(testIndex, 'error', result.message || `${command} failed`, result);
      }
    } catch (error) {
      updateResult(testIndex, 'error', `Network error: ${error}`, error);
    }
  };

  const testMissionHistory = async (droneId: string) => {
    const testIndex = results.length;
    addResult(`Get mission history for ${droneId}`, 'pending', 'Fetching...');
    
    try {
      const response = await fetch(`/api/drones/${droneId}/missions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        updateResult(testIndex, 'success', `Found ${result.count} missions`, result);
      } else {
        updateResult(testIndex, 'error', result.message || 'Failed to fetch missions', result);
      }
    } catch (error) {
      updateResult(testIndex, 'error', `Network error: ${error}`, error);
    }
  };

  const testDroneIsolation = async (drone1Id: string, drone2Id: string) => {
    const testIndex = results.length;
    addResult('Test drone isolation', 'pending', 'Checking isolation...');
    
    try {
      // Get mission history for both drones
      const [response1, response2] = await Promise.all([
        fetch(`/api/drones/${drone1Id}/missions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/drones/${drone2Id}/missions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [result1, result2] = await Promise.all([
        response1.json(),
        response2.json()
      ]);

      if (result1.success && result2.success) {
        const drone1Missions = result1.missions || [];
        const drone2Missions = result2.missions || [];
        
        // Check if missions are properly isolated
        const drone1HasOwnMissions = drone1Missions.every((m: any) => m.drone_id === drone1Id);
        const drone2HasOwnMissions = drone2Missions.every((m: any) => m.drone_id === drone2Id);
        
        if (drone1HasOwnMissions && drone2HasOwnMissions) {
          updateResult(testIndex, 'success', 
            `Isolation verified: ${drone1Id}(${drone1Missions.length}) ${drone2Id}(${drone2Missions.length})`,
            { drone1Missions, drone2Missions }
          );
        } else {
          updateResult(testIndex, 'error', 'Drone isolation failed - missions mixed up');
        }
      } else {
        updateResult(testIndex, 'error', 'Failed to fetch mission histories');
      }
    } catch (error) {
      updateResult(testIndex, 'error', `Network error: ${error}`, error);
    }
  };

  const runAllTests = async () => {
    if (!token) {
      alert('Please login first');
      return;
    }

    setIsRunning(true);
    setResults([]);

    try {
      const drone1Id = 'drone-001';
      const drone2Id = 'drone-002';

      // Test 1: Upload waypoints to both drones
      const mission1Id = await testWaypointUpload(drone1Id);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mission2Id = await testWaypointUpload(drone2Id);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test 2: Mission commands on drone 1
      if (mission1Id) {
        await testMissionCommand(drone1Id, 'start_mission', mission1Id);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await testMissionCommand(drone1Id, 'cancel_mission', mission1Id);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await testMissionCommand(drone1Id, 'clear_waypoints', mission1Id);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Test 3: Mission history
      await testMissionHistory(drone1Id);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await testMissionHistory(drone2Id);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test 4: Drone isolation
      await testDroneIsolation(drone1Id, drone2Id);

    } catch (error) {
      addResult('Test execution', 'error', `Test execution failed: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'success': return '✅';
      case 'error': return '❌';
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending': return 'text-yellow-400';
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-900 text-white rounded-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Mission Pipeline Test</h1>
        <p className="text-gray-400 mb-4">
          Test the complete waypoint mission pipeline from frontend to backend storage
        </p>
        
        <button
          onClick={runAllTests}
          disabled={isRunning || !token}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            isRunning || !token
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>
        
        {!token && (
          <p className="text-red-400 text-sm mt-2">Please login first to run tests</p>
        )}
      </div>

      <div className="space-y-3">
        {results.map((result, index) => (
          <div
            key={index}
            className="bg-gray-800 p-4 rounded-lg border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getStatusIcon(result.status)}</span>
                <div>
                  <h3 className="font-medium">{result.test}</h3>
                  <p className={`text-sm ${getStatusColor(result.status)}`}>
                    {result.message}
                  </p>
                </div>
              </div>
              
              {result.details && (
                <button
                  onClick={() => {
                    const details = document.getElementById(`details-${index}`);
                    if (details) {
                      details.style.display = details.style.display === 'none' ? 'block' : 'none';
                    }
                  }}
                  className="text-blue-400 text-sm hover:underline"
                >
                  Details
                </button>
              )}
            </div>
            
            {result.details && (
              <div
                id={`details-${index}`}
                style={{ display: 'none' }}
                className="mt-3 p-3 bg-gray-900 rounded text-xs overflow-auto max-h-40"
              >
                <pre>{JSON.stringify(result.details, null, 2)}</pre>
              </div>
            )}
          </div>
        ))}
        
        {results.length === 0 && !isRunning && (
          <div className="text-center text-gray-500 py-8">
            Click "Run All Tests" to start testing the mission pipeline
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-800 rounded-lg">
        <h3 className="font-medium mb-2">Test Coverage:</h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Waypoint upload for multiple drones</li>
          <li>• Mission command execution (start/cancel/clear)</li>
          <li>• Mission history retrieval</li>
          <li>• Drone isolation verification</li>
          <li>• Backend storage validation</li>
          <li>• Error handling and responses</li>
        </ul>
      </div>
    </div>
  );
};

export default MissionPipelineTest;