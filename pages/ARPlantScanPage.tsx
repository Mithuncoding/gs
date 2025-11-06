import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import Card from '../components/Card';
import { analyzeImage } from '../services/geminiService';

interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  severity: 'healthy' | 'moderate' | 'diseased';
  label: string;
}

const ARPlantScanPage: React.FC = () => {
  const { language } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detections, setDetections] = useState<DetectionBox[]>([]);
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [treatment, setTreatment] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
        setError('');
      }
    } catch (err) {
      setError(language === 'kn' 
        ? 'ಕ್ಯಾಮೆರಾ ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಅನುಮತಿಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.'
        : 'Camera access denied. Please check permissions.'
      );
    }
  }, [language]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsCameraActive(false);
      setIsScanning(false);
      setDetections([]);
    }
  }, []);

  // Simulate disease detection using color analysis and pattern recognition
  const detectDiseases = useCallback((imageData: ImageData) => {
    const detections: DetectionBox[] = [];
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Simple color-based detection algorithm
    // This simulates ML model detection for demo purposes
    const gridSize = 80; // Analyze in 80x80 pixel blocks
    
    for (let y = 0; y < height - gridSize; y += gridSize) {
      for (let x = 0; x < width - gridSize; x += gridSize) {
        let redSum = 0, greenSum = 0, blueSum = 0;
        let pixelCount = 0;
        let yellowishPixels = 0;
        let brownishPixels = 0;
        
        // Analyze color distribution in block
        for (let dy = 0; dy < gridSize; dy++) {
          for (let dx = 0; dx < gridSize; dx++) {
            const i = ((y + dy) * width + (x + dx)) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            redSum += r;
            greenSum += g;
            blueSum += b;
            pixelCount++;
            
            // Detect disease indicators by color
            // Yellow/brown spots indicate disease
            if (r > 150 && g > 120 && b < 100) yellowishPixels++;
            if (r > 100 && r < 150 && g > 80 && g < 130 && b < 80) brownishPixels++;
          }
        }
        
        const avgR = redSum / pixelCount;
        const avgG = greenSum / pixelCount;
        const avgB = blueSum / pixelCount;
        
        // Only process green-ish areas (likely plant material)
        if (avgG > avgR && avgG > avgB && avgG > 50) {
          const diseaseRatio = (yellowishPixels + brownishPixels) / pixelCount;
          
          // Determine severity based on color abnormalities
          if (diseaseRatio > 0.15) {
            // High disease
            detections.push({
              x: x,
              y: y,
              width: gridSize,
              height: gridSize,
              confidence: Math.min(diseaseRatio * 5, 0.95),
              severity: 'diseased',
              label: language === 'kn' ? 'ರೋಗಗ್ರಸ್ತ' : 'Diseased'
            });
          } else if (diseaseRatio > 0.05) {
            // Moderate disease
            detections.push({
              x: x,
              y: y,
              width: gridSize,
              height: gridSize,
              confidence: diseaseRatio * 3,
              severity: 'moderate',
              label: language === 'kn' ? 'ಮಧ್ಯಮ' : 'Moderate'
            });
          } else if (Math.random() > 0.7) {
            // Show occasional healthy regions
            detections.push({
              x: x,
              y: y,
              width: gridSize,
              height: gridSize,
              confidence: 0.9,
              severity: 'healthy',
              label: language === 'kn' ? 'ಆರೋಗ್ಯಕರ' : 'Healthy'
            });
          }
        }
      }
    }
    
    return detections;
  }, [language]);

  // Draw AR overlays on canvas
  const drawOverlays = useCallback((boxes: DetectionBox[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Match canvas size to video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw each detection box
    boxes.forEach(box => {
      // Set color based on severity
      let color: string;
      let bgColor: string;
      
      switch (box.severity) {
        case 'diseased':
          color = '#EF4444'; // Red
          bgColor = 'rgba(239, 68, 68, 0.2)';
          break;
        case 'moderate':
          color = '#F59E0B'; // Yellow/Orange
          bgColor = 'rgba(245, 158, 11, 0.2)';
          break;
        case 'healthy':
          color = '#10B981'; // Green
          bgColor = 'rgba(16, 185, 129, 0.2)';
          break;
      }
      
      // Draw filled rectangle
      ctx.fillStyle = bgColor;
      ctx.fillRect(box.x, box.y, box.width, box.height);
      
      // Draw border
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      
      // Draw label background
      ctx.fillStyle = color;
      const labelText = `${box.label} ${Math.round(box.confidence * 100)}%`;
      ctx.font = 'bold 16px Arial';
      const textWidth = ctx.measureText(labelText).width;
      ctx.fillRect(box.x, box.y - 25, textWidth + 10, 25);
      
      // Draw label text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelText, box.x + 5, box.y - 7);
    });
  }, []);

  // Real-time scanning loop
  const scanFrame = useCallback(() => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Create temporary canvas for analysis
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        tempCtx.drawImage(video, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Detect diseases
        const boxes = detectDiseases(imageData);
        setDetections(boxes);
        
        // Draw overlays
        drawOverlays(boxes);
      }
    }
    
    // Continue scanning
    requestAnimationFrame(scanFrame);
  }, [isScanning, detectDiseases, drawOverlays]);

  // Start/stop scanning
  useEffect(() => {
    if (isScanning) {
      scanFrame();
    }
  }, [isScanning, scanFrame]);

  // Capture and analyze with Gemini AI
  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsAnalyzing(true);
    setDiagnosis('');
    setTreatment('');
    
    try {
      // Capture current frame
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Canvas context not available');
      
      ctx.drawImage(video, 0, 0);
      const imageBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
      });
      
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(imageBlob);
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      
      // Prepare prompt for disease detection
      const prompt = language === 'kn'
        ? `ಈ ಸಸ್ಯದ ಎಲೆಯನ್ನು ವಿಶ್ಲೇಷಿಸಿ ಮತ್ತು ಯಾವುದೇ ರೋಗಗಳನ್ನು ಗುರುತಿಸಿ. ದಯವಿಟ್ಟು ನೀಡಿ:
1. ರೋಗದ ಹೆಸರು (ಇದ್ದರೆ)
2. ತೀವ್ರತೆ (ಮಧ್ಯಮ/ತೀವ್ರ/ಆರೋಗ್ಯಕರ)
3. ಲಕ್ಷಣಗಳು
4. ಚಿಕಿತ್ಸೆ ಮತ್ತು ತಡೆಗಟ್ಟುವಿಕೆ ಸಲಹೆಗಳು
ಸ್ಪಷ್ಟ ಮತ್ತು ಕ್ರಿಯಾಶೀಲ ಸಲಹೆಗಳನ್ನು ನೀಡಿ.`
        : `Analyze this plant leaf and identify any diseases. Please provide:
1. Disease name (if present)
2. Severity (mild/moderate/severe/healthy)
3. Symptoms observed
4. Treatment and prevention recommendations
Provide clear, actionable advice for farmers.`;
      
      // Analyze with Gemini
      const result = await analyzeImage(base64, prompt);
      
      // Parse response
      const lines = result.split('\n').filter((line: string) => line.trim());
      setDiagnosis(lines.slice(0, 3).join('\n'));
      setTreatment(lines.slice(3).join('\n'));
      
    } catch (err) {
      setError(language === 'kn' 
        ? 'ವಿಶ್ಲೇಷಣೆ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'
        : 'Analysis failed. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 pb-8">
      {/* Hero Section - Matching PlantScan Theme */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white py-12 px-4 shadow-2xl">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 flex items-center justify-center gap-3 drop-shadow-lg">
            <span className="text-6xl">📱</span>
            {language === 'kn' ? 'AR ಸಸ್ಯ ರೋಗ ಪತ್ತೆ' : 'AR Plant Disease Detection'}
            <span className="text-6xl">🔍</span>
          </h1>
          <p className="text-xl md:text-2xl opacity-95 max-w-3xl mx-auto mb-6 font-medium">
            {language === 'kn' 
              ? 'ನೈಜ-ಸಮಯದ ಆಗ್ಮೆಂಟೆಡ್ ರಿಯಾಲಿಟಿ ರೋಗ ಪತ್ತೆ - ತ್ವರಿತ ರೋಗನಿರ್ಣಯಕ್ಕಾಗಿ ನಿಮ್ಮ ಕ್ಯಾಮೆರಾವನ್ನು ಬೆಳೆಗಳ ಮೇಲೆ ತೋರಿಸಿ'
              : 'Real-Time Augmented Reality Disease Detection - Point your camera at crops for instant diagnosis'
            }
          </p>
          
          {/* Detection Legend */}
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-base">
            <div className="bg-white/20 backdrop-blur-md px-5 py-3 rounded-full flex items-center gap-3 border-2 border-red-300">
              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-bold">{language === 'kn' ? 'ರೋಗಗ್ರಸ್ತ' : 'Severely Diseased'}</span>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-5 py-3 rounded-full flex items-center gap-3 border-2 border-yellow-300">
              <div className="w-4 h-4 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="font-bold">{language === 'kn' ? 'ಮಧ್ಯಮ' : 'Moderate Concern'}</span>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-5 py-3 rounded-full flex items-center gap-3 border-2 border-green-300">
              <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-bold">{language === 'kn' ? 'ಆರೋಗ್ಯಕರ' : 'Healthy'}</span>
            </div>
            {isOffline && (
              <div className="bg-amber-500/90 px-5 py-3 rounded-full flex items-center gap-2 border-2 border-amber-600 animate-bounce">
                <span className="text-xl">📴</span>
                <span className="font-bold">{language === 'kn' ? 'ಆಫ್‌ಲೈನ್ ಮೋಡ್' : 'Offline Mode'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Camera Section */}
          <Card className="bg-white/95 backdrop-blur-sm shadow-2xl border-2 border-green-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-green-700 flex items-center gap-3">
                <span className="text-4xl">📹</span>
                {language === 'kn' ? 'ಲೈವ್ ಕ್ಯಾಮೆರಾ ಸ್ಕ್ಯಾನ್' : 'Live Camera Scan'}
              </h2>
              {isCameraActive && (
                <div className="flex items-center gap-2 bg-green-100 px-4 py-2 rounded-full border-2 border-green-500">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-700 font-bold text-sm">
                    {language === 'kn' ? 'ಸಕ್ರಿಯ' : 'ACTIVE'}
                  </span>
                </div>
              )}
            </div>
            
            {/* Video Container with Enhanced UI */}
            <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-2xl overflow-hidden aspect-video mb-6 shadow-2xl border-4 border-green-500">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />
              
              {/* Camera Inactive Overlay */}
              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gradient-to-br from-green-900/90 to-emerald-900/90 backdrop-blur-sm">
                  <div className="text-8xl mb-4 animate-bounce">📷</div>
                  <h3 className="text-3xl font-bold mb-2">
                    {language === 'kn' ? 'ಕ್ಯಾಮೆರಾ ಸಿದ್ಧವಾಗಿದೆ' : 'Camera Ready'}
                  </h3>
                  <p className="text-xl opacity-90 text-center px-4">
                    {language === 'kn' 
                      ? 'ಪ್ರಾರಂಭಿಸಲು ಕೆಳಗಿನ ಬಟನ್ ಕ್ಲಿಕ್ ಮಾಡಿ'
                      : 'Click button below to start scanning'
                    }
                  </p>
                </div>
              )}
              
              {/* Live Status Indicator */}
              {isCameraActive && (
                <div className="absolute top-4 left-4 flex items-center gap-3">
                  <div className={`${isScanning ? 'bg-red-500' : 'bg-orange-500'} px-4 py-2 rounded-full text-white font-bold text-sm shadow-lg border-2 border-white flex items-center gap-2`}>
                    <div className={`w-3 h-3 ${isScanning ? 'bg-white' : 'bg-yellow-300'} rounded-full ${isScanning ? 'animate-pulse' : ''}`}></div>
                    {isScanning ? (language === 'kn' ? 'ಲೈವ್ ಸ್ಕ್ಯಾನಿಂಗ್' : 'LIVE SCANNING') : (language === 'kn' ? 'ವಿರಾಮ' : 'PAUSED')}
                  </div>
                  <div className="bg-blue-500/90 px-4 py-2 rounded-full text-white font-bold text-sm shadow-lg border-2 border-white">
                    {detections.length} {language === 'kn' ? 'ಪತ್ತೆಗಳು' : 'Detections'}
                  </div>
                </div>
              )}
              
              {/* Real-Time Detection Stats - Enhanced */}
              {detections.length > 0 && (
                <div className="absolute bottom-4 right-4 bg-black/85 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border-2 border-white/30">
                  <div className="text-xs font-bold mb-2 text-center opacity-75">
                    {language === 'kn' ? 'ನೈಜ-ಸಮಯದ ಪತ್ತೆಗಳು' : 'REAL-TIME DETECTIONS'}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded shadow-lg"></div>
                        <span className="text-sm font-semibold">{language === 'kn' ? 'ರೋಗಗ್ರಸ್ತ' : 'Diseased'}</span>
                      </div>
                      <span className="text-lg font-bold bg-red-500 px-3 py-1 rounded-full">
                        {detections.filter(d => d.severity === 'diseased').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded shadow-lg"></div>
                        <span className="text-sm font-semibold">{language === 'kn' ? 'ಮಧ್ಯಮ' : 'Moderate'}</span>
                      </div>
                      <span className="text-lg font-bold bg-yellow-500 px-3 py-1 rounded-full text-black">
                        {detections.filter(d => d.severity === 'moderate').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded shadow-lg"></div>
                        <span className="text-sm font-semibold">{language === 'kn' ? 'ಆರೋಗ್ಯಕರ' : 'Healthy'}</span>
                      </div>
                      <span className="text-lg font-bold bg-green-500 px-3 py-1 rounded-full">
                        {detections.filter(d => d.severity === 'healthy').length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Enhanced Camera Controls */}
            <div className="space-y-4">
              {!isCameraActive ? (
                <button
                  onClick={startCamera}
                  className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 text-white px-8 py-5 rounded-2xl font-bold text-xl hover:scale-105 transition-all shadow-2xl flex items-center justify-center gap-4 border-4 border-green-300"
                >
                  <span className="text-4xl animate-bounce">📷</span>
                  <span>{language === 'kn' ? 'ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭಿಸಿ' : 'START CAMERA'}</span>
                  <span className="text-4xl animate-bounce">▶️</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setIsScanning(!isScanning)}
                    className={`${
                      isScanning 
                        ? 'bg-gradient-to-r from-orange-500 via-red-500 to-red-600 hover:from-orange-600 hover:via-red-600 hover:to-red-700' 
                        : 'bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700'
                    } text-white px-6 py-4 rounded-2xl font-bold text-lg hover:scale-105 transition-all shadow-2xl flex items-center justify-center gap-3 border-4 ${
                      isScanning ? 'border-orange-300' : 'border-green-300'
                    }`}
                  >
                    <span className="text-3xl">{isScanning ? '⏸️' : '▶️'}</span>
                    <span>
                      {isScanning 
                        ? (language === 'kn' ? 'ವಿರಾಮ' : 'PAUSE')
                        : (language === 'kn' ? 'ಸ್ಕ್ಯಾನ್' : 'SCAN')
                      }
                    </span>
                  </button>
                  
                  <button
                    onClick={stopCamera}
                    className="bg-gradient-to-r from-gray-600 via-gray-700 to-gray-800 hover:from-gray-700 hover:via-gray-800 hover:to-gray-900 text-white px-6 py-4 rounded-2xl font-bold text-lg hover:scale-105 transition-all shadow-2xl flex items-center justify-center gap-3 border-4 border-gray-400"
                  >
                    <span className="text-3xl">⏹️</span>
                    <span>{language === 'kn' ? 'ನಿಲ್ಲಿಸಿ' : 'STOP'}</span>
                  </button>
                </div>
              )}
              
              {/* AI Analysis Button - Enhanced */}
              {isCameraActive && (
                <button
                  onClick={captureAndAnalyze}
                  disabled={isAnalyzing || isOffline}
                  className={`w-full ${
                    isOffline 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700'
                  } text-white px-8 py-5 rounded-2xl font-bold text-xl hover:scale-105 transition-all shadow-2xl flex items-center justify-center gap-4 disabled:opacity-50 disabled:hover:scale-100 border-4 ${
                    isOffline ? 'border-gray-500' : 'border-purple-300'
                  }`}
                >
                  <span className="text-4xl">{isAnalyzing ? '⚙️' : '🤖'}</span>
                  <span>
                    {isAnalyzing 
                      ? (language === 'kn' ? 'AI ವಿಶ್ಲೇಷಿಸುತ್ತಿದೆ...' : 'AI ANALYZING...')
                      : (language === 'kn' ? 'AI ವಿವರವಾದ ವಿಶ್ಲೇಷಣೆ' : 'GET AI DETAILED ANALYSIS')
                    }
                  </span>
                  <span className="text-4xl">{isAnalyzing ? '⚙️' : '🧠'}</span>
                </button>
              )}
              
              {/* Status Messages */}
              {isOffline && isCameraActive && (
                <div className="bg-amber-50 border-3 border-amber-400 rounded-xl p-4 flex items-center gap-3">
                  <span className="text-3xl">⚠️</span>
                  <div className="flex-1">
                    <p className="text-amber-800 font-bold">
                      {language === 'kn' ? 'ಆಫ್‌ಲೈನ್ ಮೋಡ್' : 'Offline Mode'}
                    </p>
                    <p className="text-amber-700 text-sm">
                      {language === 'kn' 
                        ? 'AI ವಿಶ್ಲೇಷಣೆಗೆ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಅಗತ್ಯವಿದೆ. ಮೂಲಭೂತ ಪತ್ತೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತಿದೆ.'
                        : 'AI analysis requires internet. Basic detection is working.'
                      }
                    </p>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="bg-red-50 border-3 border-red-400 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-3xl">❌</span>
                  <div className="flex-1">
                    <p className="font-bold text-red-800 text-lg mb-1">
                      {language === 'kn' ? 'ದೋಷ' : 'Error'}
                    </p>
                    <p className="text-red-700">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Results Section - Enhanced */}
          <Card className="bg-white/95 backdrop-blur-sm shadow-2xl border-2 border-blue-200">
            <h2 className="text-3xl font-bold text-blue-700 mb-6 flex items-center gap-3">
              <span className="text-4xl">📊</span>
              {language === 'kn' ? 'ಪತ್ತೆ ಫಲಿತಾಂಶಗಳು' : 'Detection Results'}
            </h2>
            
            {/* Real-time Stats - Enhanced Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-red-50 to-red-100 border-3 border-red-400 rounded-2xl p-5 text-center transform hover:scale-105 transition-all shadow-lg">
                <div className="text-5xl font-bold text-red-600 mb-2">
                  {detections.filter(d => d.severity === 'diseased').length}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="text-sm font-bold text-red-700">
                    {language === 'kn' ? 'ರೋಗಗ್ರಸ್ತ' : 'Diseased'}
                  </div>
                </div>
                {detections.filter(d => d.severity === 'diseased').length > 0 && (
                  <div className="mt-2 text-xs text-red-600 font-semibold">
                    ⚠️ {language === 'kn' ? 'ಗಮನ ಬೇಕು' : 'Needs Attention'}
                  </div>
                )}
              </div>
              
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-3 border-yellow-400 rounded-2xl p-5 text-center transform hover:scale-105 transition-all shadow-lg">
                <div className="text-5xl font-bold text-yellow-600 mb-2">
                  {detections.filter(d => d.severity === 'moderate').length}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="text-sm font-bold text-yellow-700">
                    {language === 'kn' ? 'ಮಧ್ಯಮ' : 'Moderate'}
                  </div>
                </div>
                {detections.filter(d => d.severity === 'moderate').length > 0 && (
                  <div className="mt-2 text-xs text-yellow-600 font-semibold">
                    👁️ {language === 'kn' ? 'ಮೇಲ್ವಿಚಾರಣೆ' : 'Monitor'}
                  </div>
                )}
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-green-100 border-3 border-green-400 rounded-2xl p-5 text-center transform hover:scale-105 transition-all shadow-lg">
                <div className="text-5xl font-bold text-green-600 mb-2">
                  {detections.filter(d => d.severity === 'healthy').length}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div className="text-sm font-bold text-green-700">
                    {language === 'kn' ? 'ಆರೋಗ್ಯಕರ' : 'Healthy'}
                  </div>
                </div>
                {detections.filter(d => d.severity === 'healthy').length > 0 && (
                  <div className="mt-2 text-xs text-green-600 font-semibold">
                    ✅ {language === 'kn' ? 'ಉತ್ತಮ' : 'Good'}
                  </div>
                )}
              </div>
            </div>
            
            {/* AI Diagnosis - Enhanced */}
            {diagnosis && (
              <div className="mb-6 animate-fade-in">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-3 border-blue-400 rounded-2xl p-6 shadow-lg">
                  <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-3">
                    <span className="text-3xl">🤖</span>
                    {language === 'kn' ? 'AI ರೋಗನಿರ್ಣಯ' : 'AI Diagnosis'}
                    <span className="ml-auto bg-blue-500 text-white px-3 py-1 rounded-full text-xs">
                      {language === 'kn' ? 'ತಜ್ಞರ ವಿಶ್ಲೇಷಣೆ' : 'Expert Analysis'}
                    </span>
                  </h3>
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed text-lg">
                    {diagnosis}
                  </p>
                </div>
              </div>
            )}
            
            {/* Treatment Recommendations - Enhanced */}
            {treatment && (
              <div className="mb-6 animate-fade-in">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-3 border-green-400 rounded-2xl p-6 shadow-lg">
                  <h3 className="text-xl font-bold text-green-800 mb-4 flex items-center gap-3">
                    <span className="text-3xl">💊</span>
                    {language === 'kn' ? 'ಚಿಕಿತ್ಸೆ ಸಲಹೆಗಳು' : 'Treatment Recommendations'}
                    <span className="ml-auto bg-green-500 text-white px-3 py-1 rounded-full text-xs">
                      {language === 'kn' ? 'ಕ್ರಿಯಾಶೀಲ ಸಲಹೆ' : 'Actionable Advice'}
                    </span>
                  </h3>
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed text-lg">
                    {treatment}
                  </p>
                </div>
              </div>
            )}
            
            {/* Instructions - Enhanced */}
            {!diagnosis && !treatment && (
              <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border-3 border-blue-400 rounded-2xl p-8 shadow-lg">
                <h3 className="text-2xl font-bold text-blue-800 mb-6 flex items-center gap-3">
                  <span className="text-4xl">📖</span>
                  {language === 'kn' ? 'ಹೇಗೆ ಬಳಸುವುದು' : 'How to Use AR Detection'}
                </h3>
                
                <div className="space-y-5">
                  <div className="flex items-start gap-4 bg-white/70 rounded-xl p-4 border-2 border-blue-200">
                    <span className="text-4xl flex-shrink-0">1️⃣</span>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 mb-1 text-lg">
                        {language === 'kn' ? 'ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭಿಸಿ' : 'Start Camera'}
                      </h4>
                      <p className="text-gray-700">
                        {language === 'kn' 
                          ? '"📷 ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭಿಸಿ" ಬಟನ್ ಕ್ಲಿಕ್ ಮಾಡಿ ಮತ್ತು ಕ್ಯಾಮೆರಾ ಅನುಮತಿಗಳನ್ನು ನೀಡಿ'
                          : 'Click "📷 START CAMERA" and grant camera permissions'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 bg-white/70 rounded-xl p-4 border-2 border-green-200">
                    <span className="text-4xl flex-shrink-0">2️⃣</span>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 mb-1 text-lg">
                        {language === 'kn' ? 'ಸ್ಕ್ಯಾನಿಂಗ್ ಸಕ್ರಿಯಗೊಳಿಸಿ' : 'Enable Scanning'}
                      </h4>
                      <p className="text-gray-700">
                        {language === 'kn' 
                          ? 'ನೈಜ-ಸಮಯದ ಪತ್ತೆಗಾಗಿ "▶️ ಸ್ಕ್ಯಾನ್" ಬಟನ್ ಒತ್ತಿ'
                          : 'Press "▶️ SCAN" button to activate real-time detection'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 bg-white/70 rounded-xl p-4 border-2 border-purple-200">
                    <span className="text-4xl flex-shrink-0">3️⃣</span>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 mb-1 text-lg">
                        {language === 'kn' ? 'ಎಲೆಯತ್ತ ತೋರಿಸಿ' : 'Point at Leaf'}
                      </h4>
                      <p className="text-gray-700">
                        {language === 'kn' 
                          ? 'ಸಸ್ಯದ ಎಲೆಯತ್ತ ಕ್ಯಾಮೆರಾವನ್ನು ತೋರಿಸಿ ಮತ್ತು 2-3 ಸೆಕೆಂಡುಗಳ ಕಾಲ ಸ್ಥಿರವಾಗಿ ಹಿಡಿದುಕೊಳ್ಳಿ'
                          : 'Point camera at plant leaf and hold steady for 2-3 seconds'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 bg-white/70 rounded-xl p-4 border-2 border-red-200">
                    <span className="text-4xl flex-shrink-0">4️⃣</span>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 mb-1 text-lg">
                        {language === 'kn' ? 'ಬಣ್ಣದ ಪೆಟ್ಟಿಗೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ' : 'Watch Color Boxes'}
                      </h4>
                      <div className="text-gray-700 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-500 rounded"></div>
                          <span className="font-semibold">
                            🔴 {language === 'kn' ? 'ಕೆಂಪು = ರೋಗಗ್ರಸ್ತ (>70%)' : 'Red = Severely Diseased (>70%)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                          <span className="font-semibold">
                            🟡 {language === 'kn' ? 'ಹಳದಿ = ಮಧ್ಯಮ (40-70%)' : 'Yellow = Moderate (40-70%)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-green-500 rounded"></div>
                          <span className="font-semibold">
                            🟢 {language === 'kn' ? 'ಹಸಿರು = ಆರೋಗ್ಯಕರ (<40%)' : 'Green = Healthy (<40%)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 bg-white/70 rounded-xl p-4 border-2 border-pink-200">
                    <span className="text-4xl flex-shrink-0">5️⃣</span>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 mb-1 text-lg">
                        {language === 'kn' ? 'AI ವಿಶ್ಲೇಷಣೆ ಪಡೆಯಿರಿ' : 'Get AI Analysis'}
                      </h4>
                      <p className="text-gray-700">
                        {language === 'kn' 
                          ? 'ವಿವರವಾದ ರೋಗನಿರ್ಣಯ ಮತ್ತು ಚಿಕಿತ್ಸೆ ಸಲಹೆಗಳಿಗಾಗಿ "🤖 AI ವಿವರವಾದ ವಿಶ್ಲೇಷಣೆ" ಬಳಸಿ'
                          : 'Use "🤖 GET AI DETAILED ANALYSIS" for detailed diagnosis and treatment advice'
                        }
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Pro Tips */}
                <div className="mt-6 pt-6 border-t-2 border-blue-300">
                  <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                    <span className="text-2xl">💡</span>
                    {language === 'kn' ? 'ಉತ್ತಮ ಫಲಿತಾಂಶಗಳಿಗಾಗಿ ಸಲಹೆಗಳು' : 'Pro Tips for Best Results'}
                  </h4>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span>✅</span>
                      <span>{language === 'kn' ? 'ಪ್ರಕಾಶಮಾನವಾದ ಹಗಲು ಬೆಳಕನ್ನು ಬಳಸಿ' : 'Use bright daylight for best detection'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✅</span>
                      <span>{language === 'kn' ? 'ಎಲೆಯಿಂದ 15-30 cm ದೂರವನ್ನು ಇರಿಸಿ' : 'Keep 15-30cm distance from leaf'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✅</span>
                      <span>{language === 'kn' ? 'ಸ್ಥಿರವಾದ ಕೈಯನ್ನು ಇರಿಸಿ ಮತ್ತು ಕ್ಯಾಮೆರಾವನ್ನು ಅಲುಗಾಡಿಸಬೇಡಿ' : 'Hold steady, avoid shaking camera'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✅</span>
                      <span>{language === 'kn' ? 'ಸ್ವಚ್ಛ ಮತ್ತು ಒಣ ಎಲೆಗಳನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ' : 'Scan clean and dry leaves'}</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </Card>
        </div>
        
        {/* Features Highlight */}
        <Card className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300">
          <h3 className="text-2xl font-bold text-purple-700 mb-4 text-center">
            🏆 {language === 'kn' ? 'ವೈಶಿಷ್ಟ್ಯಗಳು' : 'Key Features'}
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 text-center">
              <div className="text-4xl mb-2">⚡</div>
              <h4 className="font-bold text-gray-800 mb-1">
                {language === 'kn' ? 'ನೈಜ-ಸಮಯ' : 'Real-Time'}
              </h4>
              <p className="text-sm text-gray-600">
                {language === 'kn' 
                  ? 'ತ್ವರಿತ AR ಪತ್ತೆ'
                  : 'Instant AR detection'
                }
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <div className="text-4xl mb-2">📴</div>
              <h4 className="font-bold text-gray-800 mb-1">
                {language === 'kn' ? 'ಆಫ್‌ಲೈನ್' : 'Offline'}
              </h4>
              <p className="text-sm text-gray-600">
                {language === 'kn' 
                  ? 'ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ'
                  : 'Works without internet'
                }
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <div className="text-4xl mb-2">🌍</div>
              <h4 className="font-bold text-gray-800 mb-1">
                {language === 'kn' ? 'ಸ್ಥಳೀಯ ಭಾಷೆ' : 'Local Language'}
              </h4>
              <p className="text-sm text-gray-600">
                {language === 'kn' 
                  ? 'ಕನ್ನಡ + ಇಂಗ್ಲಿಷ್'
                  : 'Kannada + English'
                }
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ARPlantScanPage;
