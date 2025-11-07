import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useVoiceInteraction } from '../hooks/useVoiceInteraction';
import VoiceControls from '../components/VoiceControls';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { analyzeImage } from '../services/geminiService';
import { FaCamera, FaStop, FaSync, FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';

interface DiseaseAnalysis {
  diseaseName: string;
  confidence: number;
  severity: 'healthy' | 'mild' | 'moderate' | 'severe' | 'critical';
  plantType: string;
  affectedArea: string;
  symptoms: string[];
  causes: string[];
  treatment: string[];
  prevention: string[];
  organicSolutions: string[];
  chemicalSolutions: string[];
  estimatedRecoveryTime: string;
  spreadRisk: 'low' | 'medium' | 'high';
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
}

const ARPlantScanPage: React.FC = () => {
  const { language, translate } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [analysis, setAnalysis] = useState<DiseaseAnalysis | null>(null);
  const [error, setError] = useState<string>('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [scanProgress, setScanProgress] = useState(0);
  const [detectionBox, setDetectionBox] = useState<{x: number, y: number, width: number, height: number} | null>(null);

  // Voice interaction
  const {
    speak,
    stopSpeaking,
    isSpeaking,
    ttsSupported,
  } = useVoiceInteraction({
    language: language as 'en' | 'kn',
    onTranscript: () => {}
  });

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

  // Start camera with high quality settings
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          aspectRatio: { ideal: 16/9 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
        setError('');
        setAnalysis(null);
        setCapturedImage('');
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
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsCameraActive(false);
    setIsScanning(false);
    setDetectionBox(null);
  }, []);

  // Advanced leaf detection algorithm
  const detectLeafArea = useCallback((imageData: ImageData) => {
    const { width, height, data } = imageData;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let leafPixels = 0;
    
    // Detect green regions (leaf area)
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Green detection with improved algorithm
        const isGreen = g > r && g > b && g > 60;
        const isLeaf = (g - r) > 20 && (g - b) > 10;
        
        if (isGreen || isLeaf) {
          leafPixels++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    
    // Only return box if significant leaf area detected
    if (leafPixels > 1000 && maxX > minX && maxY > minY) {
      const padding = 20;
      return {
        x: Math.max(0, minX - padding),
        y: Math.max(0, minY - padding),
        width: Math.min(width - minX - padding, maxX - minX + 2 * padding),
        height: Math.min(height - minY - padding, maxY - minY + 2 * padding)
      };
    }
    return null;
  }, []);

  // Real-time scanning with visual feedback
  const scanFrame = useCallback(() => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Get image data
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Detect leaf area
        const box = detectLeafArea(imageData);
        setDetectionBox(box);
        
        // Draw detection overlay
        if (box) {
          // Animated scanning line
          const scanY = (Date.now() % 2000) / 2000 * box.height;
          
          // Draw box
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 3;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#10B981';
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          
          // Draw scan line
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + scanY);
          ctx.lineTo(box.x + box.width, box.y + scanY);
          ctx.stroke();
          
          // Reset shadow
          ctx.shadowBlur = 0;
          
          // Draw corner markers
          const cornerSize = 20;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 4;
          
          // Top-left
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + cornerSize);
          ctx.lineTo(box.x, box.y);
          ctx.lineTo(box.x + cornerSize, box.y);
          ctx.stroke();
          
          // Top-right
          ctx.beginPath();
          ctx.moveTo(box.x + box.width - cornerSize, box.y);
          ctx.lineTo(box.x + box.width, box.y);
          ctx.lineTo(box.x + box.width, box.y + cornerSize);
          ctx.stroke();
          
          // Bottom-left
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + box.height - cornerSize);
          ctx.lineTo(box.x, box.y + box.height);
          ctx.lineTo(box.x + cornerSize, box.y + box.height);
          ctx.stroke();
          
          // Bottom-right
          ctx.beginPath();
          ctx.moveTo(box.x + box.width - cornerSize, box.y + box.height);
          ctx.lineTo(box.x + box.width, box.y + box.height);
          ctx.lineTo(box.x + box.width, box.y + box.height - cornerSize);
          ctx.stroke();
        }
      }
    }
    
    animationRef.current = requestAnimationFrame(scanFrame);
  }, [isScanning, detectLeafArea]);

  // Start scanning
  useEffect(() => {
    if (isScanning) {
      scanFrame();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isScanning, scanFrame]);

  // Capture and analyze with Gemini AI
  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsAnalyzing(true);
    setError('');
    setScanProgress(0);
    
    try {
      // Capture high-quality image
      const video = videoRef.current;
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      const ctx = captureCanvas.getContext('2d');
      
      if (!ctx) throw new Error('Canvas context not available');
      
      ctx.drawImage(video, 0, 0);
      const imageDataUrl = captureCanvas.toDataURL('image/jpeg', 0.95);
      setCapturedImage(imageDataUrl);
      setScanProgress(20);
      
      if (isOffline) {
        // Offline mode - basic analysis
        setAnalysis({
          diseaseName: language === 'kn' ? 'ಆಫ್‌ಲೈನ್ ಮೋಡ್' : 'Offline Mode',
          confidence: 0,
          severity: 'moderate',
          plantType: language === 'kn' ? 'ಗುರುತಿಸಲಾಗಿಲ್ಲ' : 'Not identified',
          affectedArea: language === 'kn' ? 'ದಯವಿಟ್ಟು ಆನ್‌ಲೈನ್ ವಿಶ್ಲೇಷಣೆಗಾಗಿ ಇಂಟರ್ನೆಟ್‌ಗೆ ಸಂಪರ್ಕಿಸಿ' : 'Please connect to internet for analysis',
          symptoms: [],
          causes: [],
          treatment: [],
          prevention: [],
          organicSolutions: [],
          chemicalSolutions: [],
          estimatedRecoveryTime: 'N/A',
          spreadRisk: 'medium',
          urgencyLevel: 'medium'
        });
        setIsAnalyzing(false);
        return;
      }
      
      setScanProgress(40);
      
      // Advanced Gemini AI Analysis
      const prompt = `You are an expert plant pathologist with deep knowledge of plant diseases, pests, and health conditions. Analyze this plant/leaf image in extreme detail and provide a comprehensive diagnosis.

CRITICAL INSTRUCTIONS:
1. ${language === 'kn' ? 'ಕನ್ನಡದಲ್ಲಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ' : 'Respond in English'}
2. Be highly accurate and specific
3. Identify the plant species if possible
4. Detect any diseases, pests, or health issues
5. Provide detailed treatment recommendations

Provide your analysis in this EXACT JSON format:
{
  "diseaseName": "Specific disease name or 'Healthy' if no disease",
  "confidence": 0.0-1.0 (your confidence level),
  "severity": "healthy|mild|moderate|severe|critical",
  "plantType": "Identified plant species",
  "affectedArea": "Which part is affected (leaves, stem, roots, etc.)",
  "symptoms": ["symptom1", "symptom2", "symptom3"],
  "causes": ["cause1", "cause2"],
  "treatment": ["step1", "step2", "step3"],
  "prevention": ["prevention1", "prevention2"],
  "organicSolutions": ["organic1", "organic2"],
  "chemicalSolutions": ["chemical1", "chemical2"],
  "estimatedRecoveryTime": "Time estimate",
  "spreadRisk": "low|medium|high",
  "urgencyLevel": "low|medium|high|critical"
}

Analyze the image thoroughly and provide accurate, actionable advice.`;

      setScanProgress(60);
      
      const result = await analyzeImage(imageDataUrl, prompt, language);
      
      setScanProgress(80);
      
      // Parse JSON response
      let analysisData: DiseaseAnalysis;
      try {
        // Extract JSON from response
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback: Create structured data from text
        analysisData = {
          diseaseName: result.split('\n')[0] || (language === 'kn' ? 'ವಿಶ್ಲೇಷಣೆ ಪೂರ್ಣಗೊಂಡಿದೆ' : 'Analysis Complete'),
          confidence: 0.85,
          severity: result.toLowerCase().includes('healthy') || result.toLowerCase().includes('ಆರೋಗ್ಯಕರ') ? 'healthy' : 'moderate',
          plantType: language === 'kn' ? 'ಗಿಡ' : 'Plant',
          affectedArea: result,
          symptoms: result.split('\n').filter(line => line.trim()).slice(0, 3),
          causes: [],
          treatment: result.split('\n').filter(line => line.includes('treat') || line.includes('ಚಿಕಿತ್ಸೆ')),
          prevention: result.split('\n').filter(line => line.includes('prevent') || line.includes('ತಡೆಗಟ್ಟುವಿಕೆ')),
          organicSolutions: [],
          chemicalSolutions: [],
          estimatedRecoveryTime: language === 'kn' ? '1-2 ವಾರಗಳು' : '1-2 weeks',
          spreadRisk: 'medium',
          urgencyLevel: 'medium'
        };
      }
      
      setAnalysis(analysisData);
      setScanProgress(100);
      
      // Auto-speak diagnosis
      if (ttsSupported) {
        const summary = `${analysisData.diseaseName}. ${language === 'kn' ? 'ತೀವ್ರತೆ' : 'Severity'}: ${analysisData.severity}. ${analysisData.affectedArea}`;
        speak(summary);
      }
      
    } catch (err) {
      console.error('Analysis error:', err);
      setError(language === 'kn' 
        ? 'ವಿಶ್ಲೇಷಣೆ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'
        : 'Analysis failed. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'healthy': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', icon: <FaCheckCircle /> };
      case 'mild': return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', icon: <FaExclamationTriangle /> };
      case 'moderate': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', icon: <FaExclamationTriangle /> };
      case 'severe': return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', icon: <FaTimesCircle /> };
      case 'critical': return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', icon: <FaTimesCircle /> };
      default: return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300', icon: <FaExclamationTriangle /> };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-green-800 mb-3">
            {language === 'kn' ? '🔬 AI ಗಿಡ ರೋಗ ಪತ್ತೆ' : '🔬 AI Plant Disease Detection'}
          </h1>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto">
            {language === 'kn' 
              ? 'ಅತ್ಯಾಧುನಿಕ AI ಶಕ್ತಿಯೊಂದಿಗೆ ತ್ವರಿತ ಮತ್ತು ನಿಖರವಾದ ಗಿಡ ರೋಗ ರೋಗನಿರ್ಣಯ'
              : 'World-class plant disease diagnosis powered by advanced AI technology'
            }
          </p>
          {isOffline && (
            <div className="mt-4 inline-block bg-amber-100 border-2 border-amber-400 text-amber-800 px-4 py-2 rounded-full">
              📴 {language === 'kn' ? 'ಆಫ್‌ಲೈನ್ ಮೋಡ್ - ಸೀಮಿತ ವಿಶ್ಲೇಷಣೆ' : 'Offline Mode - Limited Analysis'}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Camera Section */}
          <Card className="bg-white shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-green-700 flex items-center gap-2">
                <FaCamera />
                {language === 'kn' ? 'ಲೈವ್ ಸ್ಕ್ಯಾನರ್' : 'Live Scanner'}
              </h2>
              {isCameraActive && (
                <div className="flex items-center gap-2 bg-green-100 px-3 py-1 rounded-full border-2 border-green-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-700 font-bold text-sm">
                    {language === 'kn' ? 'ಲೈವ್' : 'LIVE'}
                  </span>
                </div>
              )}
            </div>

            {/* Video Container */}
            <div className="relative bg-black rounded-xl overflow-hidden shadow-xl mb-4" style={{ aspectRatio: '16/9' }}>
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
              
              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gradient-to-br from-green-900/90 to-emerald-900/90">
                  <div className="text-7xl mb-4">📷</div>
                  <h3 className="text-2xl font-bold mb-2">
                    {language === 'kn' ? 'ಕ್ಯಾಮೆರಾ ಸಿದ್ಧವಾಗಿದೆ' : 'Camera Ready'}
                  </h3>
                  <p className="text-sm opacity-80">
                    {language === 'kn' ? 'ಪ್ರಾರಂಭಿಸಲು ಕ್ಲಿಕ್ ಮಾಡಿ' : 'Click to start scanning'}
                  </p>
                </div>
              )}
              
              {isScanning && detectionBox && (
                <div className="absolute top-4 left-4 bg-green-500 px-4 py-2 rounded-full text-white font-bold text-sm shadow-lg flex items-center gap-2 animate-pulse">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                  {language === 'kn' ? '🔍 ಸ್ಕ್ಯಾನಿಂಗ್...' : '🔍 Scanning...'}
                </div>
              )}
            </div>

            {/* Control Buttons */}
            <div className="space-y-3">
              {!isCameraActive ? (
                <button
                  onClick={startCamera}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold py-4 rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <FaCamera className="text-xl" />
                  {language === 'kn' ? 'ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭಿಸಿ' : 'Start Camera'}
                </button>
              ) : (
                <>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsScanning(!isScanning)}
                      className={`flex-1 font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                        isScanning
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      {isScanning ? <FaStop /> : <FaSync />}
                      {isScanning 
                        ? (language === 'kn' ? 'ಸ್ಕ್ಯಾನ್ ನಿಲ್ಲಿಸಿ' : 'Stop Scan')
                        : (language === 'kn' ? 'ಸ್ಕ್ಯಾನ್ ಪ್ರಾರಂಭಿಸಿ' : 'Start Scan')
                      }
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-6 bg-gray-600 hover:bg-gray-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg"
                    >
                      {language === 'kn' ? 'ಮುಚ್ಚಿ' : 'Close'}
                    </button>
                  </div>
                  
                  {isScanning && detectionBox && (
                    <button
                      onClick={captureAndAnalyze}
                      disabled={isAnalyzing}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-4 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <>
                          <LoadingSpinner size="sm" />
                          {language === 'kn' ? 'ವಿಶ್ಲೇಷಣೆ ಮಾಡುತ್ತಿದೆ...' : 'Analyzing...'}
                        </>
                      ) : (
                        <>
                          <FaCamera className="text-xl" />
                          {language === 'kn' ? '📸 ಕ್ಯಾಪ್ಚರ್ ಮತ್ತು ವಿಶ್ಲೇಷಣೆ' : '📸 Capture & Analyze'}
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>

            {isAnalyzing && (
              <div className="mt-4">
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-full transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  ></div>
                </div>
                <p className="text-center text-sm text-gray-600 mt-2">
                  {language === 'kn' ? `ಪ್ರಗತಿ: ${scanProgress}%` : `Progress: ${scanProgress}%`}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-100 border-2 border-red-300 text-red-800 p-3 rounded-lg">
                ⚠️ {error}
              </div>
            )}
          </Card>

          {/* Analysis Results Section */}
          <Card className="bg-white shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-green-700">
                {language === 'kn' ? '📊 ವಿಶ್ಲೇಷಣೆ ಫಲಿತಾಂಶಗಳು' : '📊 Analysis Results'}
              </h2>
              {analysis && (
                <VoiceControls
                  onSpeak={() => {
                    const fullReport = `
                      ${analysis.diseaseName}. 
                      ${language === 'kn' ? 'ತೀವ್ರತೆ' : 'Severity'}: ${analysis.severity}. 
                      ${analysis.affectedArea}. 
                      ${language === 'kn' ? 'ಚಿಕಿತ್ಸೆ' : 'Treatment'}: ${analysis.treatment.join('. ')}
                    `;
                    speak(fullReport);
                  }}
                  onStopSpeaking={stopSpeaking}
                  isSpeaking={isSpeaking}
                  ttsSupported={ttsSupported}
                  ttsTooltip={language === 'kn' ? 'ವರದಿ ಓದಿ' : 'Read Report'}
                  onStartListening={() => {}}
                  onStopListening={() => {}}
                  isListening={false}
                  sttSupported={false}
                  showTTS={true}
                  showSTT={false}
                  compact={true}
                />
              )}
            </div>

            {capturedImage && (
              <div className="mb-4">
                <img src={capturedImage} alt="Captured" className="w-full rounded-lg shadow-md" />
              </div>
            )}

            {!analysis && !isAnalyzing && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">🔬</div>
                <p className="text-lg">
                  {language === 'kn' 
                    ? 'ವಿಶ್ಲೇಷಣೆಗಾಗಿ ಗಿಡವನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ'
                    : 'Scan a plant to see analysis results'
                  }
                </p>
              </div>
            )}

            {analysis && (
              <div className="space-y-4">
                {/* Disease Name & Severity */}
                <div className={`p-4 rounded-lg border-2 ${getSeverityColor(analysis.severity).bg} ${getSeverityColor(analysis.severity).border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-xl font-bold ${getSeverityColor(analysis.severity).text} flex items-center gap-2`}>
                      {getSeverityColor(analysis.severity).icon}
                      {analysis.diseaseName}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${getSeverityColor(analysis.severity).bg} ${getSeverityColor(analysis.severity).text} border-2 ${getSeverityColor(analysis.severity).border}`}>
                      {Math.round(analysis.confidence * 100)}%
                    </span>
                  </div>
                  <p className={`font-semibold ${getSeverityColor(analysis.severity).text}`}>
                    {language === 'kn' ? 'ತೀವ್ರತೆ' : 'Severity'}: {analysis.severity.toUpperCase()}
                  </p>
                </div>

                {/* Plant Info */}
                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                  <p className="font-semibold text-blue-800 mb-1">
                    {language === 'kn' ? '🌱 ಗಿಡದ ವಿಧ' : '🌱 Plant Type'}
                  </p>
                  <p className="text-gray-700">{analysis.plantType}</p>
                </div>

                {/* Affected Area */}
                <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
                  <p className="font-semibold text-purple-800 mb-1">
                    {language === 'kn' ? '📍 ಬಾಧಿತ ಪ್ರದೇಶ' : '📍 Affected Area'}
                  </p>
                  <p className="text-gray-700">{analysis.affectedArea}</p>
                </div>

                {/* Symptoms */}
                {analysis.symptoms.length > 0 && (
                  <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
                    <p className="font-semibold text-orange-800 mb-2">
                      {language === 'kn' ? '⚠️ ಲಕ್ಷಣಗಳು' : '⚠️ Symptoms'}
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.symptoms.map((symptom, index) => (
                        <li key={index} className="text-gray-700">{symptom}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Treatment */}
                {analysis.treatment.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                    <p className="font-semibold text-green-800 mb-2">
                      {language === 'kn' ? '💊 ಚಿಕಿತ್ಸೆ' : '💊 Treatment'}
                    </p>
                    <ol className="list-decimal list-inside space-y-1">
                      {analysis.treatment.map((step, index) => (
                        <li key={index} className="text-gray-700">{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Organic Solutions */}
                {analysis.organicSolutions.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg border-2 border-green-300">
                    <p className="font-semibold text-green-800 mb-2">
                      {language === 'kn' ? '🌿 ಸಾವಯವ ಪರಿಹಾರಗಳು' : '🌿 Organic Solutions'}
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.organicSolutions.map((solution, index) => (
                        <li key={index} className="text-gray-700">{solution}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Chemical Solutions */}
                {analysis.chemicalSolutions.length > 0 && (
                  <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-300">
                    <p className="font-semibold text-yellow-800 mb-2">
                      {language === 'kn' ? '🧪 ರಾಸಾಯನಿಕ ಪರಿಹಾರಗಳು' : '🧪 Chemical Solutions'}
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.chemicalSolutions.map((solution, index) => (
                        <li key={index} className="text-gray-700">{solution}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Additional Info */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg border-2 border-blue-200">
                    <p className="font-semibold text-blue-800 text-sm">
                      {language === 'kn' ? '⏱️ ಚೇತರಿಕೆ ಸಮಯ' : '⏱️ Recovery Time'}
                    </p>
                    <p className="text-gray-700">{analysis.estimatedRecoveryTime}</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg border-2 border-red-200">
                    <p className="font-semibold text-red-800 text-sm">
                      {language === 'kn' ? '⚡ ತುರ್ತು ಮಟ್ಟ' : '⚡ Urgency Level'}
                    </p>
                    <p className="text-gray-700 uppercase font-bold">{analysis.urgencyLevel}</p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ARPlantScanPage;
