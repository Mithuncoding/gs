import React, { useState, useCallback, useEffect, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Card from '../components/Card';
import Alert from '../components/Alert';
import VoiceControls from '../components/VoiceControls';
import { CropInsight, WeatherData, FarmingAdvice, FertPestQuantitiesAIResponse } from '../types';
import { getCropInsights, getWeatherBasedAdvice, getFertPestQuantitiesAI } from '../services/geminiService';
import { fetchWeather } from '../services/weatherService';
import { KARNATAKA_DISTRICTS, MONTHS, COMMON_CROPS, DISTRICT_NAMES_KANNADA, MONTH_NAMES_KANNADA, CROP_NAMES_KANNADA } from '../constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, LineChart, Line } from 'recharts';
import { FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaLightbulb, FaDownload } from 'react-icons/fa';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { WhatsappIcon } from 'react-share';
import Confetti from 'react-confetti';
import { fetchYouTubeThumbnails } from '../services/youtubeThumbnails';
import { useLanguage } from '../contexts/LanguageContext';
import { useVoiceInteraction } from '../hooks/useVoiceInteraction';

// Expanded mapping of districts to major cities/towns (now with more towns)
const DISTRICT_CITIES: Record<string, string[]> = {
  "Bagalkot": ["Bagalkot", "Badami", "Ilkal", "Jamkhandi", "Mudhol", "Rabkavi Banhatti", "Guledgudda", "Hungund", "Other (type your own)"],
  "Ballari (Bellary)": ["Ballari", "Hospet", "Sandur", "Kudligi", "Siruguppa", "Hagaribommanahalli", "Kampli", "Kurugodu", "Other (type your own)"],
  "Belagavi (Belgaum)": ["Belagavi", "Gokak", "Chikodi", "Athani", "Bailhongal", "Ramdurg", "Savadatti", "Hukkeri", "Khanapur", "Other (type your own)"],
  "Bengaluru Rural": ["Devanahalli", "Doddaballapur", "Nelamangala", "Hoskote", "Vijayapura", "Magadi", "Other (type your own)"],
  "Bengaluru Urban": ["Bengaluru", "Yelahanka", "KR Puram", "Whitefield", "Jayanagar", "Malleshwaram", "Hebbal", "Basavanagudi", "Banashankari", "Rajajinagar", "Vijayanagar", "Marathahalli", "BTM Layout", "Indiranagar", "Other (type your own)"],
  "Bidar": ["Bidar", "Basavakalyan", "Bhalki", "Humnabad", "Aurad", "Chitgoppa", "Other (type your own)"],
  "Chamarajanagar": ["Chamarajanagar", "Gundlupet", "Kollegal", "Yelandur", "Hanur", "Other (type your own)"],
  "Chikballapur": ["Chikballapur", "Chintamani", "Sidlaghatta", "Bagepalli", "Gudibanda", "Gauribidanur", "Other (type your own)"],
  "Chikkamagaluru": ["Chikkamagaluru", "Tarikere", "Kadur", "Mudigere", "Koppa", "Sringeri", "Ajjampura", "Other (type your own)"],
  "Chitradurga": ["Chitradurga", "Hosadurga", "Hiriyur", "Holalkere", "Molakalmuru", "Challakere", "Other (type your own)"],
  "Dakshina Kannada": ["Mangaluru", "Puttur", "Bantwal", "Sullia", "Belthangady", "Moodabidri", "Uppinangady", "Other (type your own)"],
  "Davanagere": ["Davanagere", "Harihar", "Channagiri", "Jagalur", "Honnali", "Harapanahalli", "Other (type your own)"],
  "Dharwad": ["Dharwad", "Hubballi", "Navalgund", "Kundgol", "Alnavar", "Kalghatgi", "Other (type your own)"],
  "Gadag": ["Gadag", "Betageri", "Mundargi", "Ron", "Shirhatti", "Nargund", "Other (type your own)"],
  "Hassan": ["Hassan", "Arsikere", "Belur", "Sakleshpur", "Channarayapatna", "Alur", "Holenarasipura", "Other (type your own)"],
  "Haveri": ["Haveri", "Ranebennur", "Byadgi", "Hirekerur", "Savanur", "Shiggaon", "Hanagal", "Other (type your own)"],
  "Kalaburagi (Gulbarga)": ["Kalaburagi", "Afzalpur", "Aland", "Chincholi", "Chittapur", "Jevargi", "Sedam", "Shahabad", "Other (type your own)"],
  "Kodagu": ["Madikeri", "Virajpet", "Somwarpet", "Kushalnagar", "Gonikoppal", "Other (type your own)"],
  "Kolar": ["Kolar", "Bangarapet", "Malur", "Mulbagal", "Srinivaspur", "Other (type your own)"],
  "Koppal": ["Koppal", "Gangavathi", "Kushtagi", "Yelburga", "Karatagi", "Other (type your own)"],
  "Mandya": ["Mandya", "Maddur", "Malavalli", "Srirangapatna", "Nagamangala", "Pandavapura", "Krishnarajpet", "Other (type your own)"],
  "Mysuru (Mysore)": ["Mysuru", "Nanjangud", "T. Narasipura", "Hunsur", "K.R. Nagar", "Periyapatna", "H.D. Kote", "Saragur", "Other (type your own)"],
  "Raichur": ["Raichur", "Manvi", "Sindhanur", "Lingasugur", "Devadurga", "Maski", "Other (type your own)"],
  "Ramanagara": ["Ramanagara", "Channapatna", "Kanakapura", "Magadi", "Other (type your own)"],
  "Shivamogga (Shimoga)": ["Shivamogga", "Bhadravati", "Sagar", "Tirthahalli", "Shikaripura", "Hosanagara", "Sorab", "Other (type your own)"],
  "Tumakuru (Tumkur)": ["Tumkur", "Sira", "Tiptur", "Gubbi", "Koratagere", "Kunigal", "Pavagada", "Madhugiri", "Chikkanayakanahalli", "Other (type your own)"],
  "Udupi": ["Udupi", "Kundapura", "Karkala", "Brahmavar", "Kapu", "Hebri", "Other (type your own)"],
  "Uttara Kannada": ["Karwar", "Sirsi", "Dandeli", "Bhatkal", "Kumta", "Ankola", "Honnavar", "Joida", "Yellapur", "Mundgod", "Siddapur", "Haliyal", "Other (type your own)"],
  "Vijayapura (Bijapur)": ["Vijayapura", "Basavana Bagewadi", "Indi", "Sindgi", "Muddebihal", "Devar Hippargi", "Other (type your own)"],
  "Yadgir": ["Yadgir", "Shahapur", "Surpur", "Gurmitkal", "Hunsagi", "Other (type your own)"],
};

// Kannada translations for city/town names
const CITY_NAMES_KANNADA: Record<string, string> = {
  // Bagalkot district
  "Bagalkot": "ಬಾಗಲಕೋಟೆ",
  "Badami": "ಬಾದಾಮಿ",
  "Ilkal": "ಇಳಕಲ್",
  "Jamkhandi": "ಜಾಮಖಂಡಿ",
  "Mudhol": "ಮುದಗಲ್",
  "Rabkavi Banhatti": "ರಬಕವಿ ಬಾನಹಟ್ಟಿ",
  "Guledgudda": "ಗುಳೇದಗುಡ್ಡ",
  "Hungund": "ಹುಂಗುಂದ",
  // Ballari district
  "Ballari": "ಬಳ್ಳಾರಿ",
  "Hospet": "ಹೊಸಪೇಟೆ",
  "Sandur": "ಸಂದೂರು",
  "Kudligi": "ಕುದಲಿಗಿ",
  "Siruguppa": "ಸಿರುಗುಪ್ಪ",
  "Hagaribommanahalli": "ಹಗರಿಬೊಮ್ಮನಹಳ್ಳಿ",
  "Kampli": "ಕಂಪಳಿ",
  "Kurugodu": "ಕುರುಗೋಡು",
  // Belagavi district
  "Belagavi": "ಬೆಳಗಾವಿ",
  "Gokak": "ಗೋಕಾಕ",
  "Chikodi": "ಚಿಕೋಡಿ",
  "Athani": "ಅಥಣಿ",
  "Bailhongal": "ಬೈಲಹೊಂಗಳ",
  "Ramdurg": "ರಾಮದುರ್ಗ",
  "Savadatti": "ಸಾವದತ್ತಿ",
  "Hukkeri": "ಹುಕ್ಕೇರಿ",
  "Khanapur": "ಖಾನಾಪುರ",
  // Bengaluru Rural
  "Devanahalli": "ದೇವನಹಳ್ಳಿ",
  "Doddaballapur": "ದೊಡ್ಡಬಳ್ಳಾಪುರ",
  "Nelamangala": "ನೆಲಮಂಗಲ",
  "Hoskote": "ಹೊಸಕೋಟೆ",
  "Vijayapura": "ವಿಜಯಪುರ",
  "Magadi": "ಮಾಗಡಿ",
  // Bengaluru Urban
  "Bengaluru": "ಬೆಂಗಳೂರು",
  "Yelahanka": "ಯೆಲಹಂಕ",
  "KR Puram": "ಕೆ.ಆರ್. ಪುರಂ",
  "Whitefield": "ವೈಟ್ಫೀಲ್ಡ್",
  "Jayanagar": "ಜಯನಗರ",
  "Malleshwaram": "ಮಲ್ಲೇಶ್ವರಂ",
  "Hebbal": "ಹೆಬ್ಬಾಳ",
  "Basavanagudi": "ಬಸವನಗುಡಿ",
  "Banashankari": "ಬನಶಂಕರಿ",
  "Rajajinagar": "ರಾಜಾಜಿನಗರ",
  "Vijayanagar": "ವಿಜಯನಗರ",
  "Marathahalli": "ಮಾರಥಹಳ್ಳಿ",
  "BTM Layout": "ಬಿ.ಟಿ.ಎಂ. ಲೇಔಟ್",
  "Indiranagar": "ಇಂದಿರಾನಗರ",
  // Bidar district
  "Bidar": "ಬೀದರ್",
  "Basavakalyan": "ಬಸವಕಲ್ಯಾಣ",
  "Bhalki": "ಭಲ್ಕಿ",
  "Humnabad": "ಹುಮನಾಬಾದ",
  "Aurad": "ಔರದ",
  "Chitgoppa": "ಚಿತ್‌ಗೋಪ್ಪ",
  // Chamarajanagar district
  "Chamarajanagar": "ಚಾಮರಾಜನಗರ",
  "Gundlupet": "ಗುಂಡಲುಪೇಟೆ",
  "Kollegal": "ಕೊಳ್ಳೇಗಾಲ",
  "Yelandur": "ಯಲ್ಲಂದೂರು",
  "Hanur": "ಹಾನೂರು",
  // Chikballapur district
  "Chikballapur": "ಚಿಕ್ಕಬಳ್ಳಾಪುರ",
  "Chintamani": "ಚಿಂತಾಮಣಿ",
  "Sidlaghatta": "ಸಿದ್ಲಾಘಟ್ಟ",
  "Bagepalli": "ಬಾಗೇಪಲ್ಲಿ",
  "Gudibanda": "ಗುಡಿಬಂಡೆ",
  "Gauribidanur": "ಗೌರಿಬಿದನೂರು",
  // Chikkamagaluru district
  "Chikkamagaluru": "ಚಿಕ್ಕಮಗಳೂರು",
  "Tarikere": "ತರಿಕೇರೆ",
  "Kadur": "ಕದೂರು",
  "Mudigere": "ಮುದಿಗೆರೆ",
  "Koppa": "ಕೊಪ್ಪ",
  "Sringeri": "ಶೃಂಗೇರಿ",
  "Ajjampura": "ಅಜ್ಜಂಪುರ",
  // Chitradurga district
  "Chitradurga": "ಚಿತ್ರದುರ್ಗ",
  "Hosadurga": "ಹೊಸದುರ್ಗ",
  "Hiriyur": "ಹಿರಿಯೂರು",
  "Holalkere": "ಹೊಲಲ್ಕೆರೆ",
  "Molakalmuru": "ಮೊಳಕಾಲ್ಮೂರು",
  "Challakere": "ಚಳ್ಳಕೆರೆ",
  // Dakshina Kannada district
  "Mangaluru": "ಮಂಗಳೂರು",
  "Puttur": "ಪುತ್ತೂರು",
  "Bantwal": "ಬಂಟ್ವಾಳ",
  "Sullia": "ಸುಳ್ಯ",
  "Belthangady": "ಬೆಳ್ತಂಗಡಿ",
  "Moodabidri": "ಮೂಡುಬಿದಿರೆ",
  "Uppinangady": "ಉಪ್ಪಿನಂಗಡಿ",
  // Davanagere district
  "Davanagere": "ದಾವಣಗೆರೆ",
  "Harihar": "ಹರಿಹರ",
  "Channagiri": "ಚನ್ನಗಿರಿ",
  "Jagalur": "ಜಗಳೂರು",
  "Honnali": "ಹೊನ್ನಾಳಿ",
  "Harapanahalli": "ಹರಪನಹಳ್ಳಿ",
  // Dharwad district
  "Dharwad": "ಧಾರವಾಡ",
  "Hubballi": "ಹುಬ್ಬಳ್ಳಿ",
  "Navalgund": "ನವಲಗುಂದ",
  "Kundgol": "ಕುಂದಗೋಲ",
  "Alnavar": "ಆಳನಾವರು",
  "Kalghatgi": "ಕಲಗಟ್ಗಿ",
  // Gadag district
  "Gadag": "ಗದಗ",
  "Betageri": "ಬೇತಗೇರಿ",
  "Mundargi": "ಮುಂಡರಗಿ",
  "Ron": "ರೋಣ",
  "Shirhatti": "ಶಿರಹಟ್ಟಿ",
  "Nargund": "ನಾರಗುಂದ",
  // Hassan district
  "Hassan": "ಹಾಸನ",
  "Arsikere": "ಅರಸೀಕೆರೆ",
  "Belur": "ಬೇಲೂರು",
  "Sakleshpur": "ಸಕಲೇಶಪುರ",
  "Channarayapatna": "ಚನ್ನರಾಯಪಟ್ಟಣ",
  "Alur": "ಆಲೂರು",
  "Holenarasipura": "ಹೊಳೆನರಸೀಪುರ",
  // Haveri district
  "Haveri": "ಹಾವೇರಿ",
  "Ranebennur": "ರಾಣೇಬೆನ್ನೂರು",
  "Byadgi": "ಬ್ಯಾಡಗಿ",
  "Hirekerur": "ಹಿರೇಕೇರೂರು",
  "Savanur": "ಸಾವನೂರು",
  "Shiggaon": "ಶಿಗ್ಗಾಂವ",
  "Hanagal": "ಹಾನಗಲ್",
  // Kalaburagi district
  "Kalaburagi": "ಕಲಬುರಗಿ",
  "Afzalpur": "ಅಫಜಲ್ಪುರ",
  "Aland": "ಆಳಂದ",
  "Chincholi": "ಚಿಂಚೋಳಿ",
  "Chittapur": "ಚಿತ್ತಾಪುರ",
  "Jevargi": "ಜೇವರಗಿ",
  "Sedam": "ಸೇಡಂ",
  "Shahabad": "ಶಾಹಾಬಾದ",
  // Kodagu district
  "Madikeri": "ಮಡಿಕೇರಿ",
  "Virajpet": "ವಿರಾಜಪೇಟೆ",
  "Somwarpet": "ಸೋಮವಾರಪೇಟೆ",
  "Kushalnagar": "ಕುಶಲನಗರ",
  "Gonikoppal": "ಗೋಣಿಕೊಪ್ಪಲ್",
  // Kolar district
  "Kolar": "ಕೋಲಾರ",
  "Bangarapet": "ಬಂಗಾರಪೇಟೆ",
  "Malur": "ಮಾಲೂರು",
  "Mulbagal": "ಮುಳಬಾಗಲು",
  "Srinivaspur": "ಶ್ರೀನಿವಾಸಪುರ",
  // Koppal district
  "Koppal": "ಕೊಪ್ಪಳ",
  "Gangavathi": "ಗಂಗಾವತಿ",
  "Kushtagi": "ಕುಷ್ಟಗಿ",
  "Yelburga": "ಯೆಲಬುರ್ಗ",
  "Karatagi": "ಕರತಗಿ",
  // Mandya district
  "Mandya": "ಮಂಡ್ಯ",
  "Maddur": "ಮದ್ದೂರು",
  "Malavalli": "ಮಾಳವಳ್ಳಿ",
  "Srirangapatna": "ಶ್ರೀರಂಗಪಟ್ಟಣ",
  "Nagamangala": "ನಾಗಮಂಗಲ",
  "Pandavapura": "ಪಾಂಡವಪುರ",
  "Krishnarajpet": "ಕೃಷ್ಣರಾಜಪೇಟೆ",
  // Mysuru district
  "Mysuru": "ಮೈಸೂರು",
  "Nanjangud": "ನಂಜನಗೂಡು",
  "T. Narasipura": "ಟಿ. ನರಸೀಪುರ",
  "Hunsur": "ಹುಣಸೂರು",
  "K.R. Nagar": "ಕೆ.ಆರ್. ನಗರ",
  "Periyapatna": "ಪೇರಿಯಪಟ್ಟಣ",
  "H.D. Kote": "ಎಚ್.ಡಿ. ಕೋಟೆ",
  "Saragur": "ಸಾರಗೂರು",
  // Raichur district
  "Raichur": "ರಾಯಚೂರು",
  "Manvi": "ಮಾನವಿ",
  "Sindhanur": "ಸಿಂಧನೂರು",
  "Lingasugur": "ಲಿಂಗಸೂಗೂರು",
  "Devadurga": "ದೇವದುರ್ಗ",
  "Maski": "ಮಸ್ಕಿ",
  // Ramanagara district
  "Ramanagara": "ರಾಮನಗರ",
  "Channapatna": "ಚನ್ನಪಟ್ಟಣ",
  "Kanakapura": "ಕನಕಪುರ",
  // Shivamogga district
  "Shivamogga": "ಶಿವಮೊಗ್ಗ",
  "Bhadravati": "ಭದ್ರಾವತಿ",
  "Sagar": "ಸಾಗರ",
  "Tirthahalli": "ತೀರ್ಥಹಳ್ಳಿ",
  "Shikaripura": "ಶಿಕಾರಿಪುರ",
  "Hosanagara": "ಹೊಸನಗರ",
  "Sorab": "ಸೋರಾಬ",
  // Tumakuru district
  "Tumkur": "ತುಮಕೂರು",
  "Sira": "ಸಿರಾ",
  "Tiptur": "ತಿಪ್ತೂರು",
  "Gubbi": "ಗುಬ್ಬಿ",
  "Koratagere": "ಕೋರಟಗೆರೆ",
  "Kunigal": "ಕುಣಿಗಲ್",
  "Pavagada": "ಪಾವಗಡ",
  "Madhugiri": "ಮಧುಗಿರಿ",
  "Chikkanayakanahalli": "ಚಿಕ್ಕನಾಯಕನಹಳ್ಳಿ",
  // Udupi district
  "Udupi": "ಉಡುಪಿ",
  "Kundapura": "ಕುಂದಾಪುರ",
  "Karkala": "ಕಾರ್ಕಳ",
  "Brahmavar": "ಬ್ರಹ್ಮಾವರ",
  "Kapu": "ಕಾಪು",
  "Hebri": "ಹೆಬ್ರಿ",
  // Uttara Kannada district
  "Karwar": "ಕಾರವಾರ",
  "Sirsi": "ಸಿರಸಿ",
  "Dandeli": "ದಾಂಡೇಲಿ",
  "Bhatkal": "ಭಟ್ಕಳ",
  "Kumta": "ಕುಂಟಾ",
  "Ankola": "ಅಂಕೋಲ",
  "Honnavar": "ಹೊನ್ನಾವರು",
  "Joida": "ಜೋಯಿಡ",
  "Yellapur": "ಯೆಲ್ಲಾಪುರ",
  "Mundgod": "ಮುಂಡಗೋಡ",
  "Siddapur": "ಸಿದ್ದಾಪುರ",
  "Haliyal": "ಹಾಲಿಯಾಳ",
  // Vijayapura district
  "Basavana Bagewadi": "ಬಸವನ ಬಾಗೇವಾಡಿ",
  "Indi": "ಇಂದಿ",
  "Sindgi": "ಸಿಂದಗಿ",
  "Muddebihal": "ಮುದ್ದೇಬಿಹಾಳ",
  "Devar Hippargi": "ದೇವರ ಹಿಪ್ಪರಗಿ",
  // Yadgir district
  "Yadgir": "ಯಾದಗಿರಿ",
  "Shahapur": "ಶಾಹಾಪುರ",
  "Surpur": "ಸೂರಪುರ",
  "Gurmitkal": "ಗುರ್ಮಿಟ್ಕಲ್",
  "Hunsagi": "ಹುಣಸಗಿ",
  // Common
  "Other (type your own)": "ಇತರೆ (ನಿಮ್ಮದೇ ಆದದನ್ನು ಟೈಪ್ ಮಾಡಿ)"
};

const COLORS = ["#34d399", "#fbbf24", "#60a5fa", "#f87171", "#a78bfa", "#f472b6", "#38bdf8", "#facc15", "#4ade80", "#f472b6"];

// Fertilizer and pesticide mapping for common crops
const FERT_PEST_RECOMMENDATIONS: Record<string, { fertilizers: string[]; pesticides: string[] }> = {
  "Rice": {
    fertilizers: ["Urea (N)", "DAP (P)", "MOP (K)", "Zinc Sulphate"],
    pesticides: ["Cartap Hydrochloride", "Chlorantraniliprole", "Buprofezin"]
  },
  "Wheat": {
    fertilizers: ["Urea", "SSP", "MOP", "Micronutrients"],
    pesticides: ["Imidacloprid", "Mancozeb", "Propiconazole"]
  },
  "Maize": {
    fertilizers: ["Urea", "DAP", "MOP", "Boron"],
    pesticides: ["Carbofuran", "Atrazine", "Cypermethrin"]
  },
  "Tomato": {
    fertilizers: ["NPK 19:19:19", "Calcium Nitrate", "Compost"],
    pesticides: ["Imidacloprid", "Mancozeb", "Spinosad"]
  },
  "Potato": {
    fertilizers: ["Urea", "DAP", "Potash", "Gypsum"],
    pesticides: ["Chlorpyrifos", "Mancozeb", "Metalaxyl"]
  },
  "Banana": {
    fertilizers: ["Urea", "MOP", "FYM", "Micronutrients"],
    pesticides: ["Carbofuran", "Chlorpyrifos", "Copper Oxychloride"]
  },
  "Sugarcane": {
    fertilizers: ["Urea", "DAP", "MOP", "Zinc Sulphate"],
    pesticides: ["Imidacloprid", "Chlorpyrifos", "Carbendazim"]
  },
  "Cotton": {
    fertilizers: ["Urea", "SSP", "MOP", "Micronutrients"],
    pesticides: ["Imidacloprid", "Quinalphos", "Carbendazim"]
  },
  "Groundnut": {
    fertilizers: ["Gypsum", "SSP", "Potash", "Boron"],
    pesticides: ["Chlorpyrifos", "Mancozeb", "Hexaconazole"]
  },
  // ... add more crops as needed ...
};

const CombinedInsightsPage: React.FC = () => {
  const { language, translate } = useLanguage();
  
  // Voice interaction hook
  const {
    speak,
    stopSpeaking,
    isSpeaking,
    ttsSupported,
    startListening,
    stopListening,
    isListening,
    transcript,
    sttSupported,
    sttError
  } = useVoiceInteraction({
    language: language as 'en' | 'kn',
    onTranscript: (text) => {
      // Handle voice input - could be used for custom crop/city input
      console.log('Voice transcript:', text);
    }
  });
  
  const [selectedDistrict, setSelectedDistrict] = useState<string>(KARNATAKA_DISTRICTS[0]);
  const [city, setCity] = useState<string>(DISTRICT_CITIES[KARNATAKA_DISTRICTS[0]] ? DISTRICT_CITIES[KARNATAKA_DISTRICTS[0]][0] : KARNATAKA_DISTRICTS[0]);
  const [customCity, setCustomCity] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[new Date().getMonth()]);
  const [selectedCrop, setSelectedCrop] = useState<string>("");
  const [customCrop, setCustomCrop] = useState<string>("");
  const [acres, setAcres] = useState<string>("");
  const [insights, setInsights] = useState<CropInsight | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [aiAdvice, setAIAdvice] = useState<FarmingAdvice | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const insightRef = useRef<HTMLDivElement>(null);
  const [aiFertPestQuantities, setAiFertPestQuantities] = useState<FertPestQuantitiesAIResponse | null>(null);
  const [aiFertPestLoading, setAiFertPestLoading] = useState<boolean>(false);
  const [youtubeThumbs, setYoutubeThumbs] = useState<{title: string, thumbnail: string, videoId: string}[]>([]);
  const [youtubeLoading, setYoutubeLoading] = useState(false);

  // Update city dropdown when district changes
  useEffect(() => {
    const cities = DISTRICT_CITIES[selectedDistrict];
    if (cities && cities.length > 0) {
      setCity(cities[0]);
      setCustomCity("");
    } else {
      setCity(selectedDistrict); // fallback
      setCustomCity("");
    }
  }, [selectedDistrict]);

  // Helper to get the actual city value
  const getCityValue = () => (city === "Other (type your own)" ? customCity : city);
  const getCropValue = () => (selectedCrop === "Other (type your own)" ? customCrop : selectedCrop);

  // Only fetch when user clicks button
  const fetchAll = useCallback(async () => {
    const cityValue = getCityValue();
    const cropValue = getCropValue();
    if (!selectedDistrict || !selectedMonth || !cityValue) {
      setError("Please select a district, month, and city.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setInsights(null);
    setWeather(null);
    setAIAdvice(null);
    setHasFetched(false);
    setAiFertPestQuantities(null);
    setAiFertPestLoading(false);
    // Fetch weather and crop insights in parallel
    const [weatherResult, cropResult] = await Promise.all([
      fetchWeather(cityValue),
      getCropInsights(selectedDistrict, selectedMonth, language)
    ]);
    if ('error' in weatherResult) {
      setError(weatherResult.error);
      setIsLoading(false);
      return;
    }
    if (cropResult.error) {
      setError(cropResult.error);
      setIsLoading(false);
      return;
    }
    setWeather(weatherResult);
    setInsights(cropResult);
    // Compose a context string for the AI
    const cropContext = cropResult.suitableCrops && cropResult.suitableCrops.length > 0
      ? `The most suitable crops for ${selectedDistrict} in ${selectedMonth} are: ${cropResult.suitableCrops.join(', ')}.`
      : `No suitable crops found for ${selectedDistrict} in ${selectedMonth}.`;
    const weatherJson = JSON.stringify({
      temperature: weatherResult.temperature,
      humidity: weatherResult.humidity,
      description: weatherResult.description,
      rain_last_hour_mm: weatherResult.rain || 0,
    });
    const aiAdviceResult = await getWeatherBasedAdvice(weatherJson, `${cropContext} Current city: ${weatherResult.city}${cropValue ? ", User is interested in: " + cropValue : ""}`, language);
    setAIAdvice(aiAdviceResult);
    // AI-powered fertilizer/pesticide quantities
    if (cropValue && acres && !isNaN(parseFloat(acres)) && parseFloat(acres) > 0) {
      setAiFertPestLoading(true);
      const fertPestResult = await getFertPestQuantitiesAI(
        cropValue,
        selectedDistrict,
        selectedMonth,
        weatherResult,
        parseFloat(acres),
        language
      );
      setAiFertPestQuantities(fertPestResult);
      setAiFertPestLoading(false);
    } else {
      setAiFertPestQuantities(null);
    }
    setIsLoading(false);
    setHasFetched(true);
  }, [selectedDistrict, selectedMonth, city, customCity, selectedCrop, customCrop, acres]);

  // Helper for crop chips
  const cropEmoji = (crop: string) => {
    if (/rice/i.test(crop)) return '🍚';
    if (/wheat/i.test(crop)) return '🌾';
    if (/maize|corn/i.test(crop)) return '🌽';
    if (/tomato/i.test(crop)) return '🍅';
    if (/potato/i.test(crop)) return '🥔';
    if (/banana/i.test(crop)) return '🍌';
    if (/sugarcane/i.test(crop)) return '🌿';
    if (/cotton/i.test(crop)) return '⚪';
    if (/groundnut/i.test(crop)) return '🥜';
    if (/chilli/i.test(crop)) return '🌶️';
    if (/onion/i.test(crop)) return '🧅';
    if (/millet/i.test(crop)) return '🌾';
    if (/soybean/i.test(crop)) return '🌱';
    if (/sunflower/i.test(crop)) return '🌻';
    if (/mustard/i.test(crop)) return '🌱';
    if (/pea/i.test(crop)) return '🫛';
    if (/sorghum|jowar/i.test(crop)) return '🌾';
    if (/barley/i.test(crop)) return '🌾';
    if (/bajra|pearl millet/i.test(crop)) return '🌾';
    if (/coconut/i.test(crop)) return '🥥';
    if (/mango/i.test(crop)) return '🥭';
    if (/apple/i.test(crop)) return '🍎';
    if (/orange/i.test(crop)) return '🍊';
    if (/grape/i.test(crop)) return '🍇';
    if (/pomegranate/i.test(crop)) return '🔴';
    if (/lemon/i.test(crop)) return '🍋';
    if (/cabbage/i.test(crop)) return '🥬';
    if (/cauliflower/i.test(crop)) return '🥦';
    if (/carrot/i.test(crop)) return '🥕';
    if (/brinjal|eggplant/i.test(crop)) return '🍆';
    if (/beans/i.test(crop)) return '🫘';
    if (/okra|bhindi/i.test(crop)) return '🌱';
    if (/pumpkin/i.test(crop)) return '🎃';
    if (/papaya/i.test(crop)) return '🥭';
    if (/guava/i.test(crop)) return '🍈';
    if (/pineapple/i.test(crop)) return '🍍';
    if (/watermelon/i.test(crop)) return '🍉';
    if (/cucumber/i.test(crop)) return '🥒';
    return '🪴';
  };

  // Prepare data for charts
  const cropChartData = insights && insights.allCrops ?
    insights.allCrops.map((crop, idx) => ({
      name: crop,
      value: insights.suitableCrops && insights.suitableCrops.includes(crop) ? 1 : 0.5,
      emoji: cropEmoji(crop),
      color: insights.suitableCrops && insights.suitableCrops.includes(crop) ? COLORS[idx % COLORS.length] : '#d1d5db',
    })) : [];

  // Mocked historical weather data (for demo)
  const historicalWeather = weather ? [
    { month: 'Jan', temp: 22, rain: 2 },
    { month: 'Feb', temp: 24, rain: 1 },
    { month: 'Mar', temp: 28, rain: 3 },
    { month: 'Apr', temp: 32, rain: 8 },
    { month: 'May', temp: 34, rain: 15 },
    { month: 'Jun', temp: 29, rain: 40 },
    { month: 'Jul', temp: 27, rain: 60 },
    { month: 'Aug', temp: 27, rain: 55 },
    { month: 'Sep', temp: 28, rain: 30 },
    { month: 'Oct', temp: 26, rain: 12 },
    { month: 'Nov', temp: 24, rain: 5 },
    { month: 'Dec', temp: 22, rain: 2 },
  ] : [];

  const handleDownloadPDF = async (shareViaWhatsApp = false) => {
    if (!insightRef.current) return;
    setPdfLoading(true);
    setShowConfetti(true);
    // Scroll insights into view and wait for rendering
    insightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(res => setTimeout(res, 500));
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'visible';
    const canvas = await html2canvas(insightRef.current, { backgroundColor: '#fff', scale: 3, useCORS: true, windowWidth: insightRef.current.scrollWidth, windowHeight: insightRef.current.scrollHeight });
    document.body.style.overflow = originalOverflow;
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pageWidth - 40;
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    let remainingHeight = imgHeight;
    if (imgHeight < pageHeight - 40) {
      pdf.addImage(imgData, 'PNG', 20, 20, pdfWidth, imgHeight);
    } else {
      let page = 0;
      while (remainingHeight > 0) {
        const sourceY = page * (pageHeight - 40) * (imgProps.height / imgHeight);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgProps.width;
        pageCanvas.height = Math.min(imgProps.height - sourceY, (pageHeight - 40) * (imgProps.height / imgHeight));
        const ctx = pageCanvas.getContext('2d');
        ctx?.drawImage(canvas, 0, sourceY, imgProps.width, pageCanvas.height, 0, 0, imgProps.width, pageCanvas.height);
        const pageImgData = pageCanvas.toDataURL('image/png');
        pdf.addImage(pageImgData, 'PNG', 20, 20, pdfWidth, pageCanvas.height * (pdfWidth / imgProps.width));
        remainingHeight -= (pageHeight - 40);
        if (remainingHeight > 0) pdf.addPage();
        page++;
      }
    }
    if (shareViaWhatsApp) {
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], `Crop_Weather_Insights_${getCityValue()}_${selectedDistrict}_${selectedMonth}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Crop & Weather Insights', text: shareText });
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
        alert('PDF downloaded. Please share it manually via WhatsApp.');
      }
    } else {
      pdf.save(`Crop_Weather_Insights_${getCityValue()}_${selectedDistrict}_${selectedMonth}.pdf`);
    }
    setTimeout(() => setShowConfetti(false), 2000);
    setPdfLoading(false);
  };

  const shareText = `Check out these AI-powered crop & weather insights for ${getCityValue()}, ${selectedDistrict} (${selectedMonth})!`;

  useEffect(() => {
    const crop = getCropValue();
    if (crop && selectedDistrict) {
      setYoutubeLoading(true);
      // 1st: crop farming in district, 2nd: district Karnataka
      Promise.all([
        fetchYouTubeThumbnails(`${crop} farming in ${selectedDistrict} Karnataka`, 1),
        fetchYouTubeThumbnails(`${selectedDistrict} district Karnataka`, 1)
      ]).then(results => {
        setYoutubeThumbs([...(results[0] || []), ...(results[1] || [])]);
        setYoutubeLoading(false);
      }).catch(() => setYoutubeLoading(false));
    } else {
      setYoutubeThumbs([]);
    }
    // eslint-disable-next-line
  }, [selectedCrop, customCrop, selectedDistrict]);

  return (
    <div className="bg-white min-h-screen">
      {showConfetti && <Confetti numberOfPieces={200} recycle={false} width={window.innerWidth} height={window.innerHeight} />}
      {pdfLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 shadow-lg flex flex-col items-center gap-4">
            <LoadingSpinner text="Generating PDF..." />
            <span className="text-green-700 font-semibold">Preparing your full report...</span>
          </div>
        </div>
      )}
      <div className="container mx-auto px-4 py-8">
        {/* Banner and sharing controls */}
        {hasFetched && insights && weather && aiAdvice && (
          <>
            <div className="bg-gradient-to-r from-green-300 via-yellow-100 to-pink-100 rounded-xl px-4 py-3 text-green-900 font-bold shadow mb-4 text-center animate-fade-in">
              📄 Download or share your full AI-powered Crop & Weather Insights Report!
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
              <div className="w-full md:w-auto text-center md:text-left">
                <div className="bg-gradient-to-r from-green-200 via-yellow-100 to-pink-100 rounded-xl px-4 py-2 text-green-900 font-semibold shadow animate-fade-in">
                  🌟 You can print, download as PDF, or share these insights with your friends and fellow farmers!
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <button onClick={() => handleDownloadPDF(false)} className="px-4 py-2 rounded-full bg-gradient-to-r from-green-400 via-lime-300 to-yellow-300 text-white font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                  <FaDownload /> Download PDF
                </button>
                <button onClick={() => handleDownloadPDF(true)} className="px-4 py-2 rounded-full bg-green-500 text-white font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                  <WhatsappIcon size={24} round /> Share as PDF
                </button>
              </div>
            </div>
          </>
        )}
        {/* Main insights content to capture for PDF */}
        <div ref={insightRef}>
          <h2 className="text-4xl font-extrabold text-green-700 mb-6 text-center tracking-tight animate-fade-in">
            🌾 {translate('combinedCropWeatherTitle')}
          </h2>
          <p className="text-lg text-gray-700 mb-8 text-center max-w-2xl mx-auto animate-fade-in">
            {translate('getAIPoweredRec')} <span className="font-bold text-green-600">{translate('personalizedRealTime')}</span> {translate('inYourDistrict')}
          </p>
          {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
          <Card className="mb-8 bg-gradient-to-br from-green-100 via-lime-100 to-yellow-50 border-2 border-green-300 animate-fade-in">
            <div className="grid md:grid-cols-5 gap-6 mb-6 items-end">
              <div>
                <label htmlFor="district-select" className="block text-sm font-medium text-gray-700 mb-1">{translate('district')}</label>
                <select
                  id="district-select"
                  value={selectedDistrict}
                  onChange={e => setSelectedDistrict(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                >
                  {KARNATAKA_DISTRICTS.map(district => (
                    <option key={district} value={district}>
                      {language === 'kn' ? DISTRICT_NAMES_KANNADA[district] || district : district}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="city-select" className="block text-sm font-medium text-gray-700 mb-1">{translate('cityTown')}</label>
                <select
                  id="city-select"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                >
                  {(DISTRICT_CITIES[selectedDistrict] || [selectedDistrict]).map(cityOption => (
                    <option key={cityOption} value={cityOption}>
                      {language === 'kn' ? CITY_NAMES_KANNADA[cityOption] || cityOption : cityOption}
                    </option>
                  ))}
                </select>
                {city === "Other (type your own)" && (
                  <input
                    type="text"
                    value={customCity}
                    onChange={e => setCustomCity(e.target.value)}
                    placeholder="Enter city/town name"
                    className="w-full mt-2 p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  />
                )}
              </div>
              <div>
                <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 mb-1">{translate('month')}</label>
                <select
                  id="month-select"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                >
                  {MONTHS.map(month => (
                    <option key={month} value={month}>
                      {language === 'kn' ? MONTH_NAMES_KANNADA[month] || month : month}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="crop-select" className="block text-sm font-medium text-gray-700 mb-1">{translate('cropOptional')}</label>
                <select
                  id="crop-select"
                  value={selectedCrop}
                  onChange={e => setSelectedCrop(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">{translate('selectCrop')}</option>
                  {COMMON_CROPS.map(crop => (
                    <option key={crop} value={crop}>
                      {language === 'kn' ? CROP_NAMES_KANNADA[crop] || crop : crop}
                    </option>
                  ))}
                  <option value="Other (type your own)">
                    {language === 'kn' ? 'ಇತರೆ (ನಿಮ್ಮದೇ ಆದದನ್ನು ಟೈಪ್ ಮಾಡಿ)' : 'Other (type your own)'}
                  </option>
                </select>
                {selectedCrop === "Other (type your own)" && (
                  <input
                    type="text"
                    value={customCrop}
                    onChange={e => setCustomCrop(e.target.value)}
                    placeholder="Enter crop name"
                    className="w-full mt-2 p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  />
                )}
              </div>
              <div>
                <label htmlFor="acres-input" className="block text-sm font-medium text-gray-700 mb-1">{translate('acres')}</label>
                <input
                  id="acres-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={acres}
                  onChange={e => setAcres(e.target.value)}
                  placeholder="e.g. 2.5"
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <button
                onClick={fetchAll}
                disabled={isLoading || !selectedDistrict || !selectedMonth || !getCityValue()}
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-green-500 via-lime-400 to-yellow-400 text-white font-semibold rounded-md shadow-md hover:scale-105 transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : translate('getCombinedInsights')}
              </button>
            </div>
            
            {/* Voice transcript display */}
            {transcript && (
              <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                <p className="text-sm font-semibold text-blue-700 mb-1">
                  {language === 'kn' ? 'ಧ್ವನಿ ಇನ್‌ಪುಟ್:' : 'Voice Input:'}
                </p>
                <p className="text-gray-800">{transcript}</p>
              </div>
            )}
            
            {sttError && (
              <div className="mt-2 text-sm text-red-600">
                {language === 'kn' ? 'ಧ್ವನಿ ದೋಷ:' : 'Voice Error:'} {sttError}
              </div>
            )}
          </Card>
          {isLoading && <LoadingSpinner text="Fetching crop & weather insights..." />}
          {/* Weather Section as stat cards only */}
          {hasFetched && weather && (
            <Card className="mb-8 bg-gradient-to-br from-blue-100 via-cyan-100 to-green-50 border-2 border-blue-300 animate-fade-in">
              <h3 className="text-2xl font-bold text-blue-700 mb-4 flex items-center gap-2">🌦️ Real-Time Weather in {weather.city}</h3>
              <div className="grid md:grid-cols-4 gap-4 text-center mb-6">
                <div className="bg-blue-200 p-4 rounded-lg shadow-lg">
                  <p className="text-4xl font-bold text-blue-700">{weather.temperature}°C</p>
                  <p className="text-blue-800 font-semibold">Temperature</p>
                </div>
                <div className="bg-cyan-200 p-4 rounded-lg shadow-lg">
                  <p className="text-4xl font-bold text-cyan-700">{weather.humidity}%</p>
                  <p className="text-cyan-800 font-semibold">Humidity</p>
                </div>
                <div className="bg-green-200 p-4 rounded-lg shadow-lg">
                  <p className="text-4xl font-bold text-green-700">{weather.rain ?? 0} mm</p>
                  <p className="text-green-800 font-semibold">Rain (last hour)</p>
                </div>
                <div className="bg-yellow-100 p-4 rounded-lg shadow-lg flex flex-col items-center justify-center">
                  {weather.iconUrl && <img src={weather.iconUrl} alt={weather.description} className="w-16 h-16 mb-2" />}
                  <p className="text-blue-900 font-semibold capitalize mt-1">{weather.description}</p>
                </div>
              </div>
            </Card>
          )}
          {/* Crop Insights Section + Improved Chart */}
          {hasFetched && insights && (
            <Card className="mb-8 bg-gradient-to-br from-green-100 via-lime-100 to-yellow-50 border-2 border-green-300 animate-fade-in">
              <h3 className="text-2xl font-bold text-green-700 mb-4 flex items-center gap-2">🌱 Crop Insights for {getCityValue()}, {insights.district} - {insights.month}</h3>
              <div className="flex flex-col items-center justify-center w-full">
                {cropChartData.length > 0 ? (
                  <div className="w-full max-h-96 overflow-x-auto">
                    <ResponsiveContainer width="100%" height={Math.max(220, cropChartData.length * 36)}>
                      <BarChart layout="vertical" data={cropChartData} margin={{ top: 30, right: 40, left: 120, bottom: 30 }} barCategoryGap={12}>
                        <XAxis type="number" hide domain={[0, 1]} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 18, fontWeight: 600 }} width={180} interval={0} />
                        <Tooltip formatter={(value) => value === 1 ? 'Suitable' : 'Other'} labelFormatter={name => `Crop: ${name}`} />
                        <Bar dataKey="value" radius={[8, 8, 8, 8]} minPointSize={12} maxBarSize={32}>
                          {cropChartData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.value === 1 ? '#34d399' : '#d1d5db'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8">No crop data available for this city/district/month.</div>
                )}
              </div>
              {/* YouTube Thumbnails Section (INSIDE Crop Insights Card) */}
              {youtubeLoading && (
                <div className="flex justify-center my-4"><LoadingSpinner text="Loading YouTube images..." /></div>
              )}
              {youtubeThumbs.length > 0 && (
                <div className="flex justify-center gap-4 my-4">
                  {youtubeThumbs.map((yt, idx) => (
                    <a
                      key={yt.videoId}
                      href={`https://www.youtube.com/watch?v=${yt.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={yt.title}
                    >
                      <img
                        src={yt.thumbnail}
                        alt={yt.title}
                        className="rounded-lg shadow-md object-cover"
                        style={{ width: 220, height: 140 }}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}
              {/* End YouTube Thumbnails Section */}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col items-center justify-center">
                  {insights.suitableCrops && insights.suitableCrops.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2 justify-center">
                      {insights.suitableCrops.map((crop, idx) => (
                        <span key={idx} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-400 via-lime-300 to-yellow-200 text-green-900 font-semibold shadow animate-glow text-lg">
                          <span>{cropEmoji(crop)}</span> {crop}
                        </span>
                      ))}
                    </div>
                  )}
                  {insights.tips && (
                    <div className="mb-4">
                      <h4 className="text-lg font-semibold text-green-600 mb-1">🌟 Farming Tips:</h4>
                      <p className="text-gray-700 whitespace-pre-line">{insights.tips}</p>
                    </div>
                  )}
                  {insights.climatePatterns && (
                    <div>
                      <h4 className="text-lg font-semibold text-green-600 mb-1">🌤️ Typical Climate Patterns:</h4>
                      <p className="text-gray-700 whitespace-pre-line">{insights.climatePatterns}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
          {/* Historical Weather Data (mocked) */}
          {hasFetched && weather && (
            <Card className="mb-8 bg-gradient-to-br from-blue-50 via-green-50 to-yellow-50 border-2 border-blue-200 animate-fade-in">
              <h3 className="text-xl font-bold text-blue-700 mb-4 flex items-center gap-2">📈 Historical Weather (Demo)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={historicalWeather} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 14 }} />
                  <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 14 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 14 }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#60a5fa" name="Temperature (°C)" strokeWidth={3} />
                  <Line yAxisId="right" type="monotone" dataKey="rain" stroke="#34d399" name="Rain (mm)" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
          {/* Fertilizer and Pesticide Suggestions */}
          {hasFetched && getCropValue() && acres && parseFloat(acres) > 0 && (
            <Card className="mb-8 bg-gradient-to-br from-yellow-50 via-green-50 to-blue-50 border-2 border-yellow-300 animate-fade-in">
              <h3 className="text-xl font-bold text-yellow-700 mb-2 flex items-center gap-2">🧪 Fertilizer & 🛡️ Pesticide Suggestions for <span className="ml-1 text-green-700">{getCropValue()}</span></h3>
              {aiFertPestLoading && <LoadingSpinner text="Fetching AI-powered fertilizer & pesticide recommendations..." />}
              {aiFertPestQuantities && !aiFertPestQuantities.error && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold text-green-700 mb-1">Recommended Fertilizers:</h4>
                    <ul className="list-disc ml-6 space-y-1">
                      {aiFertPestQuantities.fertilizers.map((f, i) => (
                        <li key={i} className="bg-green-100 rounded px-3 py-1 inline-block mb-1 text-green-900 font-medium shadow animate-fade-in">
                          {f.name} <span className="text-xs text-gray-500">({f.per_acre} {f.unit}/acre × {acres} acre{parseFloat(acres) > 1 ? 's' : ''} = <b>{f.total}</b> {f.unit})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-blue-700 mb-1">Recommended Pesticides:</h4>
                    <ul className="list-disc ml-6 space-y-1">
                      {aiFertPestQuantities.pesticides.map((p, i) => (
                        <li key={i} className="bg-blue-100 rounded px-3 py-1 inline-block mb-1 text-blue-900 font-medium shadow animate-fade-in">
                          {p.name} <span className="text-xs text-gray-500">({p.per_acre} {p.unit}/acre × {acres} acre{parseFloat(acres) > 1 ? 's' : ''} = <b>{p.total}</b> {p.unit})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {aiFertPestQuantities && aiFertPestQuantities.error && (
                <Alert type="error" message={`AI Fertilizer/Pesticide Error: ${aiFertPestQuantities.error}`} />
              )}
              {!aiFertPestQuantities && !aiFertPestLoading && (
                <div className="text-gray-500 text-center py-4">No AI-powered fertilizer/pesticide data available. Please enter crop and acres.</div>
              )}
              <div className="mt-3 text-gray-600 text-sm">* Always follow local agricultural guidelines and consult an expert for dosage and application schedule.</div>
            </Card>
          )}
          {/* AI Combined Recommendation Section */}
          {hasFetched && aiAdvice && aiAdvice.advice && (
            (() => {
              // --- Advanced NLP for summary, reasons, alternatives ---
              const adviceText = aiAdvice.advice;
              const lower = adviceText.toLowerCase();
              let status: 'Recommended' | 'Not Recommended' | 'Conditional' | 'Unknown' = 'Unknown';
              if (/not suitable|avoid|do not|unsuitable|not recommended|strongly advise against|poor decision|waste of resources|high risk|detrimental|failure|loss|unreliable|not advised|not ideal/.test(lower)) {
                status = 'Not Recommended';
              } else if (/recommended|suitable|go ahead|good choice|ideal|best|strongly recommend|excellent|perfect/.test(lower)) {
                status = 'Recommended';
              } else if (/if|however|may|might|could|conditional|depends|with caution|consult/.test(lower)) {
                status = 'Conditional';
              }
              // Smart summary extraction
              let summary = '';
              if (status === 'Not Recommended') {
                // Try to extract main crop and reason
                const cropMatch = adviceText.match(/(?:cultivate|growing|planting|attempting to grow|raise|sow)\s+([A-Za-z ]+)/i);
                const crop = cropMatch ? cropMatch[1].trim() : 'This crop';
                const reasonMatch = adviceText.match(/not suitable.*?\.|avoid.*?\.|waste.*?\.|high risk.*?\.|failure.*?\.|detrimental.*?\.|unreliable.*?\./gi);
                const reason = reasonMatch ? reasonMatch.map(s => s.trim()).join(' ') : 'is NOT recommended for the selected location and time.';
                summary = `${crop} is NOT recommended. ${reason}`;
              } else if (status === 'Recommended') {
                summary = 'This crop is recommended for the selected location and time.';
              } else if (status === 'Conditional') {
                summary = 'Recommendation is conditional. Please review the details below.';
              } else {
                summary = 'Unable to determine a clear recommendation. Please consult a local expert.';
              }
              // Extract reasons (sentences with negative words)
              const reasons = adviceText.match(/([^.]*?(not suitable|avoid|waste|risk|failure|detrimental|unreliable|not advised|not ideal)[^.]*\.)/gi) || [];
              // Extract alternatives (sentences with 'instead', 'alternatives', 'focus on', 'consider', 'such as', 'better suited')
              const alternatives = adviceText.match(/([^.]*?(instead|alternatives|focus on|consider|such as|better suited)[^.]*\.)/gi) || [];
              // Fallback: try to extract crop names from alternatives
              let altCrops = '';
              if (alternatives.length === 0) {
                const altMatch = adviceText.match(/(Ragi|Groundnut|Maize|Cowpea|Urad|Moong|Cotton|Pomegranate|Grapes|vegetables|millet|pulses|legumes|oilseeds|fruits|cereals|horticultural crops)/gi);
                if (altMatch) altCrops = 'Consider: ' + [...new Set(altMatch)].join(', ');
              }
              // Color and icon
              const statusColor = status === 'Recommended' ? 'bg-green-500 text-white' : status === 'Not Recommended' ? 'bg-red-500 text-white' : status === 'Conditional' ? 'bg-yellow-400 text-black' : 'bg-gray-400 text-white';
              const statusIcon = status === 'Recommended' ? <FaCheckCircle className="inline mr-2 text-2xl" /> : status === 'Not Recommended' ? <FaTimesCircle className="inline mr-2 text-2xl" /> : status === 'Conditional' ? <FaExclamationTriangle className="inline mr-2 text-2xl" /> : <FaLightbulb className="inline mr-2 text-2xl" />;
              return (
                <Card className="mb-8 bg-gradient-to-br from-yellow-100 via-orange-100 to-pink-50 border-2 border-yellow-400 animate-fade-in shadow-2xl relative overflow-hidden">
                  {/* Subtle animated background pattern */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none animate-pulse" style={{background: 'radial-gradient(circle at 30% 30%, #fbbf24 0%, transparent 70%), radial-gradient(circle at 70% 70%, #f472b6 0%, transparent 70%)'}}></div>
                  
                  {/* Voice Controls */}
                  <div className="flex justify-end mb-4 z-20 relative">
                    <VoiceControls
                      onSpeak={() => speak(adviceText)}
                      onStopSpeaking={stopSpeaking}
                      isSpeaking={isSpeaking}
                      ttsSupported={ttsSupported}
                      ttsTooltip={language === 'kn' ? 'ಜೋರಾಗಿ ಓದಿ' : 'Read aloud'}
                      onStartListening={startListening}
                      onStopListening={stopListening}
                      isListening={isListening}
                      sttSupported={sttSupported}
                      sttTooltip={language === 'kn' ? 'ಧ್ವನಿ ಇನ್‌ಪುಟ್' : 'Voice input'}
                      showTTS={true}
                      showSTT={false}
                      compact={false}
                    />
                  </div>
                  
                  {/* Status and summary */}
                  <div className={`flex flex-col items-center justify-center gap-2 mb-6 mt-2 px-6 py-3 rounded-xl shadow-lg text-xl font-bold ${statusColor} animate-glow z-10 relative`}>
                    <div>{statusIcon} {status}</div>
                    <div className="text-base font-medium mt-1 text-center">{summary}</div>
                  </div>
                  {/* Reasons section */}
                  {reasons.length > 0 && (
                    <div className="mb-4 z-10 relative">
                      <div className="text-lg font-semibold text-red-700 mb-2 flex items-center gap-2"><FaTimesCircle className="text-red-400" /> Reasons:</div>
                      <ul className="space-y-2">
                        {reasons.map((r, i) => (
                          <li key={i} className="bg-red-100 rounded-lg px-4 py-2 text-red-900 shadow animate-fade-in flex items-center gap-2"><FaExclamationTriangle className="text-red-400 mr-2" /> {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Alternatives section */}
                  {(alternatives.length > 0 || altCrops) && (
                    <div className="mb-4 z-10 relative">
                      <div className="text-lg font-semibold text-green-700 mb-2 flex items-center gap-2"><FaLightbulb className="text-green-400" /> Alternatives:</div>
                      <ul className="space-y-2">
                        {alternatives.map((a, i) => (
                          <li key={i} className="bg-green-100 rounded-lg px-4 py-2 text-green-900 shadow animate-fade-in flex items-center gap-2"><FaCheckCircle className="text-green-400 mr-2" /> {a}</li>
                        ))}
                        {altCrops && <li className="bg-green-100 rounded-lg px-4 py-2 text-green-900 shadow animate-fade-in flex items-center gap-2"><FaCheckCircle className="text-green-400 mr-2" /> {altCrops}</li>}
                      </ul>
                    </div>
                  )}
                  {/* Ambiguous fallback */}
                  {status === 'Unknown' && (
                    <div className="text-center text-gray-700 font-medium py-4 z-10 relative">Unable to determine a clear recommendation. Please consult a local agricultural expert for personalized advice.</div>
                  )}
                </Card>
              );
            })()
          )}
          {hasFetched && aiAdvice && aiAdvice.error && <Alert type="error" message={`AI Response Error: ${aiAdvice.error}`} />}
        </div>
      </div>
    </div>
  );
};

export default CombinedInsightsPage;
