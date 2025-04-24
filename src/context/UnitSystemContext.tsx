import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UnitSystem = 'metric' | 'imperial';

interface UnitSystemContextType {
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => void;
  toggleUnitSystem: () => void;
  isMetric: boolean;
}

const UnitSystemContext = createContext<UnitSystemContextType | undefined>(undefined);

// Key for storing unit system preference
const UNIT_SYSTEM_STORAGE_KEY = 'roacook_unit_system';

export const UnitSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('metric');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved preference on mount
  useEffect(() => {
    const loadUnitSystem = async () => {
      try {
        const savedSystem = await AsyncStorage.getItem(UNIT_SYSTEM_STORAGE_KEY);
        if (savedSystem && (savedSystem === 'metric' || savedSystem === 'imperial')) {
          setUnitSystemState(savedSystem);
        }
      } catch (error) {
        console.error('Failed to load unit system preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUnitSystem();
  }, []);

  // Set unit system and save to storage
  const setUnitSystem = async (system: UnitSystem) => {
    try {
      await AsyncStorage.setItem(UNIT_SYSTEM_STORAGE_KEY, system);
      setUnitSystemState(system);
    } catch (error) {
      console.error('Failed to save unit system preference:', error);
    }
  };

  // Toggle between metric and imperial
  const toggleUnitSystem = () => {
    const newSystem = unitSystem === 'metric' ? 'imperial' : 'metric';
    setUnitSystem(newSystem);
  };

  if (isLoading) {
    // You could return a loading indicator here if needed
    return <>{children}</>;
  }

  return (
    <UnitSystemContext.Provider 
      value={{ 
        unitSystem, 
        setUnitSystem, 
        toggleUnitSystem,
        isMetric: unitSystem === 'metric'
      }}
    >
      {children}
    </UnitSystemContext.Provider>
  );
};

// Custom hook to use the unit system context
export const useUnitSystem = (): UnitSystemContextType => {
  const context = useContext(UnitSystemContext);
  if (context === undefined) {
    throw new Error('useUnitSystem must be used within a UnitSystemProvider');
  }
  return context;
};

// Utility functions for unit conversions
export const convertWeight = (value: number, toSystem: UnitSystem): number => {
  if (toSystem === 'metric') {
    // Convert from imperial to metric (oz to g)
    return value * 28.35;
  } else {
    // Convert from metric to imperial (g to oz)
    return value / 28.35;
  }
};

export const convertVolume = (value: number, toSystem: UnitSystem): number => {
  if (toSystem === 'metric') {
    // Convert from imperial to metric (fl oz to ml)
    return value * 29.57;
  } else {
    // Convert from metric to imperial (ml to fl oz)
    return value / 29.57;
  }
};

export const convertTemperature = (value: number, toSystem: UnitSystem): number => {
  if (toSystem === 'metric') {
    // Convert from Fahrenheit to Celsius
    return (value - 32) * 5/9;
  } else {
    // Convert from Celsius to Fahrenheit
    return (value * 9/5) + 32;
  }
};

export const getUnitLabel = (unit: string, unitSystem: UnitSystem): string => {
  // Map of unit conversions from metric to imperial and vice versa
  const unitMappings: Record<string, { metric: string, imperial: string }> = {
    // Weight
    'g': { metric: 'g', imperial: 'oz' },
    'kg': { metric: 'kg', imperial: 'lb' },
    'oz': { metric: 'g', imperial: 'oz' },
    'lb': { metric: 'kg', imperial: 'lb' },
    
    // Volume
    'ml': { metric: 'ml', imperial: 'fl oz' },
    'l': { metric: 'l', imperial: 'qt' },
    'fl oz': { metric: 'ml', imperial: 'fl oz' },
    'cup': { metric: 'ml', imperial: 'cup' },
    'pt': { metric: 'ml', imperial: 'pt' },
    'qt': { metric: 'l', imperial: 'qt' },
    'gal': { metric: 'l', imperial: 'gal' },
    
    // Temperature
    '°C': { metric: '°C', imperial: '°F' },
    '°F': { metric: '°C', imperial: '°F' },
    
    // Length
    'mm': { metric: 'mm', imperial: 'in' },
    'cm': { metric: 'cm', imperial: 'in' },
    'm': { metric: 'm', imperial: 'ft' },
    'in': { metric: 'cm', imperial: 'in' },
    'ft': { metric: 'm', imperial: 'ft' },
  };

  // Try to find mapping, but if not found, return original unit
  if (unit in unitMappings) {
    return unitMappings[unit][unitSystem];
  }
  
  return unit; // Return original if no mapping exists
}; 