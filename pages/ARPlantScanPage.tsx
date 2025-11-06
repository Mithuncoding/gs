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
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

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

  // Improved detection: 1 box per leaf with better algorithm
  const detectDiseases = useCallback((imageData: ImageData) => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    let yellowishPixels = 0;
    let brownishPixels = 0;
    let greenPixels = 0;
    
    // Find bounding box of green regions (leaf area)
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    // Analyze entire image
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Detect green-ish areas (likely plant material)
        if (g > r && g > b && g > 50) {
          greenPixels++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          
          redSum += r;
          greenSum += g;
          blueSum += b;
          pixelCount++;
          
          // Detect disease indicators by color
          if (r > 150 && g > 120 && b < 100) yellowishPixels++;
          if (r > 100 && r < 150 && g > 80 && g < 130 && b < 80) brownishPixels++;
        }
      }
    }
    
    // Only create one box if leaf detected
    if (greenPixels > 1000) { // Minimum pixels for a leaf
      const diseaseRatio = (yellowishPixels + brownishPixels) / pixelCount;
      
      // Add padding to bounding box
      const padding = 20;
      const boxX = Math.max(0, minX - padding);
      const boxY = Math.max(0, minY - padding);
      const boxWidth = Math.min(width - boxX, maxX - minX + padding * 2);
      const boxHeight = Math.min(height - boxY, maxY - minY + padding * 2);
      
      let severity: 'healthy' | 'moderate' | 'diseased';
      let label: string;
      
      if (diseaseRatio > 0.15) {
        severity = 'diseased';
        label = language === 'kn' ? 'ರೋಗಗ್ರಸ್ತ' : 'Diseased';
      } else if (diseaseRatio > 0.05) {
        severity = 'moderate';
        label = language === 'kn' ? 'ಮಧ್ಯಮ' : 'Moderate';
      } else {
        severity = 'healthy';
        label = language === 'kn' ? 'ಆರೋಗ್ಯಕರ' : 'Healthy';
      }
      
      return [{
        x: boxX,
        y: boxY,
        width: boxWidth,
        height: boxHeight,
        confidence: Math.min(diseaseRatio > 0.05 ? diseaseRatio * 5 : 0.9, 0.95),
        severity: severity,
        label: label
      }];
    }
    
    return [];
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

  // Capture photo with detection box
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;
    
    // Create a new canvas to combine video + overlay
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const ctx = captureCanvas.getContext('2d');
    
    if (!ctx) return;
    
    // Draw video frame
    ctx.drawImage(video, 0, 0);
    
    // Draw detection overlays on top
    if (detections.length > 0) {
      drawOverlays(detections);
      // Copy canvas overlay to capture
      ctx.drawImage(canvas, 0, 0);
    }
    
    // Convert to base64
    const photoData = captureCanvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhoto(photoData);
    
    // Auto-download
    const link = document.createElement('a');
    link.href = photoData;
    link.download = `plant-detection-${Date.now()}.jpg`;
    link.click();
  };

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
      {/* Hero Section - Mobile Responsive */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white py-6 md:py-12 px-4 shadow-2xl">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-2xl md:text-5xl lg:text-6xl font-bold mb-3 md:mb-4 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 drop-shadow-lg">
            <span className="text-4xl md:text-6xl">📱</span>
            <span>{language === 'kn' ? 'AR ಸಸ್ಯ ರೋಗ ಪತ್ತೆ' : 'AR Plant Disease Detection'}</span>
            <span className="text-4xl md:text-6xl">🔍</span>
          </h1>
          <p className="text-sm md:text-xl lg:text-2xl opacity-95 max-w-3xl mx-auto mb-4 md:mb-6 font-medium">
            {language === 'kn' 
              ? 'ನೈಜ-ಸಮಯದ ರೋಗ ಪತ್ತೆ - ಎಲೆಯತ್ತ ಕ್ಯಾಮೆರಾ ತೋರಿಸಿ'
              : 'Real-Time Detection - Point camera at leaf'
            }
          </p>
          
          {/* Detection Legend - Mobile Responsive */}
          <div className="mt-4 md:mt-6 flex flex-wrap justify-center gap-2 md:gap-4 text-xs md:text-base">
            <div className="bg-white/20 backdrop-blur-md px-3 md:px-5 py-2 md:py-3 rounded-full flex items-center gap-2 border-2 border-red-300">
              <div className="w-3 h-3 md:w-4 md:h-4 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-bold">{language === 'kn' ? 'ರೋಗಗ್ರಸ್ತ' : 'Diseased'}</span>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-3 md:px-5 py-2 md:py-3 rounded-full flex items-center gap-2 border-2 border-yellow-300">
              <div className="w-3 h-3 md:w-4 md:h-4 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="font-bold">{language === 'kn' ? 'ಮಧ್ಯಮ' : 'Moderate'}</span>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-3 md:px-5 py-2 md:py-3 rounded-full flex items-center gap-2 border-2 border-green-300">
              <div className="w-3 h-3 md:w-4 md:h-4 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-bold">{language === 'kn' ? 'ಆರೋಗ್ಯಕರ' : 'Healthy'}</span>
            </div>
            {isOffline && (
              <div className="bg-amber-500/90 px-3 md:px-5 py-2 md:py-3 rounded-full flex items-center gap-1 md:gap-2 border-2 border-amber-600">
                <span className="text-base md:text-xl">📴</span>
                <span className="font-bold">{language === 'kn' ? 'ಆಫ್‌ಲೈನ್' : 'Offline'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6 md:mt-8">
        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
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
            <div className="space-y-3">
              {!isCameraActive ? (
                <button
                  onClick={startCamera}
                  className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 text-white px-6 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-3"
                >
                  <span className="text-3xl">📷</span>
                  <span>{language === 'kn' ? 'ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭಿಸಿ' : 'START CAMERA'}</span>
                </button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsScanning(!isScanning)}
                      className={`${
                        isScanning 
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600' 
                          : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                      } text-white px-4 py-3 rounded-xl font-bold text-base hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2`}
                    >
                      <span className="text-2xl">{isScanning ? '⏸️' : '▶️'}</span>
                      <span className="hidden sm:inline">
                        {isScanning 
                          ? (language === 'kn' ? 'ವಿರಾಮ' : 'PAUSE')
                          : (language === 'kn' ? 'ಸ್ಕ್ಯಾನ್' : 'SCAN')
                        }
                      </span>
                    </button>
                    
                    <button
                      onClick={stopCamera}
                      className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-4 py-3 rounded-xl font-bold text-base hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <span className="text-2xl">⏹️</span>
                      <span className="hidden sm:inline">{language === 'kn' ? 'ನಿಲ್ಲಿಸಿ' : 'STOP'}</span>
                    </button>
                  </div>
                  
                  {/* Capture Photo Button */}
                  {detections.length > 0 && (
                    <button
                      onClick={capturePhoto}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-bold text-base hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-3"
                    >
                      <span className="text-2xl">📸</span>
                      <span>{language === 'kn' ? 'ಫೋಟೋ ಕ್ಯಾಪ್ಚರ್ ಮಾಡಿ' : 'CAPTURE PHOTO'}</span>
                      <span className="text-2xl">💾</span>
                    </button>
                  )}
                </>
              )}
              
              {/* AI Analysis Button */}
              {isCameraActive && detections.length > 0 && (
                <button
                  onClick={captureAndAnalyze}
                  disabled={isAnalyzing || isOffline}
                  className={`w-full ${
                    isOffline 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  } text-white px-6 py-3 rounded-xl font-bold text-base hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100`}
                >
                  <span className="text-2xl">{isAnalyzing ? '⚙️' : '🤖'}</span>
                  <span>
                    {isAnalyzing 
                      ? (language === 'kn' ? 'ವಿಶ್ಲೇಷಣೆ...' : 'ANALYZING...')
                      : (language === 'kn' ? 'AI ವಿಶ್ಲೇಷಣೆ' : 'AI ANALYSIS')
                    }
                  </span>
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

          {/* Results Section - Simplified for single detection */}
          <Card className="bg-white/95 backdrop-blur-sm shadow-xl border-2 border-blue-200">
            <h2 className="text-2xl md:text-3xl font-bold text-blue-700 mb-4 flex items-center gap-2">
              <span className="text-3xl">📊</span>
              {language === 'kn' ? 'ಪತ್ತೆ ಫಲಿತಾಂಶ' : 'Detection Result'}
            </h2>
            
            {/* Single Leaf Detection Status */}
            {detections.length > 0 ? (
              <div className="mb-6">
                <div className={`p-6 rounded-xl text-center shadow-lg border-3 ${
                  detections[0].severity === 'diseased' 
                    ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-400'
                    : detections[0].severity === 'moderate'
                    ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-400'
                    : 'bg-gradient-to-br from-green-50 to-green-100 border-green-400'
                }`}>
                  <div className={`text-6xl font-bold mb-2 ${
                    detections[0].severity === 'diseased' ? 'text-red-600'
                    : detections[0].severity === 'moderate' ? 'text-yellow-600'
                    : 'text-green-600'
                  }`}>
                    {detections[0].severity === 'diseased' ? '🔴' : detections[0].severity === 'moderate' ? '🟡' : '🟢'}
                  </div>
                  <div className={`text-2xl font-bold mb-2 ${
                    detections[0].severity === 'diseased' ? 'text-red-700'
                    : detections[0].severity === 'moderate' ? 'text-yellow-700'
                    : 'text-green-700'
                  }`}>
                    {detections[0].label}
                  </div>
                  <div className={`text-sm font-semibold ${
                    detections[0].severity === 'diseased' ? 'text-red-600'
                    : detections[0].severity === 'moderate' ? 'text-yellow-600'
                    : 'text-green-600'
                  }`}>
                    {language === 'kn' ? 'ವಿಶ್ವಾಸ' : 'Confidence'}: {Math.round(detections[0].confidence * 100)}%
                  </div>
                  {detections[0].severity === 'diseased' && (
                    <div className="mt-3 text-sm text-red-700 font-semibold">
                      ⚠️ {language === 'kn' ? 'ತಕ್ಷಣ ಗಮನ ಬೇಕು!' : 'Immediate attention needed!'}
                    </div>
                  )}
                  {detections[0].severity === 'moderate' && (
                    <div className="mt-3 text-sm text-yellow-700 font-semibold">
                      👁️ {language === 'kn' ? 'ನಿಯಮಿತವಾಗಿ ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡಿ' : 'Monitor regularly'}
                    </div>
                  )}
                  {detections[0].severity === 'healthy' && (
                    <div className="mt-3 text-sm text-green-700 font-semibold">
                      ✅ {language === 'kn' ? 'ಉತ್ತಮ ಆರೋಗ್ಯ!' : 'Good health!'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-6xl mb-3">🔍</div>
                <p className="text-lg">
                  {language === 'kn' 
                    ? 'ಎಲೆಯನ್ನು ಪತ್ತೆ ಮಾಡಲಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಸಸ್ಯದ ಎಲೆಯತ್ತ ಕ್ಯಾಮೆರಾವನ್ನು ತೋರಿಸಿ.'
                    : 'No leaf detected. Please point camera at a plant leaf.'
                  }
                </p>
              </div>
            )}
            
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
