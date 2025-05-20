import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useUnitSystem, convertWeight, convertVolume, convertTemperature, getUnitLabel } from '../context/UnitSystemContext';
import { appLogger } from '../services/AppLogService';

interface UnitDisplayProps {
  value: number;
  unit: string;
  style?: TextStyle;
  skipConversion?: boolean;
  showUnit?: boolean;
  decimals?: number;
}

/**
 * Component that displays a value with appropriate unit conversion
 * based on the selected unit system (metric or imperial)
 */
const UnitDisplay: React.FC<UnitDisplayProps> = ({
  value,
  unit,
  style,
  skipConversion = false,
  showUnit = true,
  decimals = 1,
}) => {
  const { unitSystem, isMetric } = useUnitSystem();
  
  // Convert the value based on unit type if needed
  let displayValue = value;
  
  if (!skipConversion) {
    // Weight conversions
    if (['g', 'oz', 'kg', 'lb'].includes(unit)) {
      if ((isMetric && ['oz', 'lb'].includes(unit)) || (!isMetric && ['g', 'kg'].includes(unit))) {
        displayValue = convertWeight(value, unitSystem);
      }
    }
    
    // Volume conversions
    else if (['ml', 'l', 'fl oz', 'cup', 'pt', 'qt', 'gal'].includes(unit)) {
      if ((isMetric && ['fl oz', 'cup', 'pt', 'qt', 'gal'].includes(unit)) || 
          (!isMetric && ['ml', 'l'].includes(unit))) {
        displayValue = convertVolume(value, unitSystem);
      }
    }
    
    // Temperature conversions
    else if (['°C', '°F'].includes(unit)) {
      if ((isMetric && unit === '°F') || (!isMetric && unit === '°C')) {
        displayValue = convertTemperature(value, unitSystem);
      }
    }
  }
  
  // Format the value
  const formattedValue = displayValue.toFixed(decimals);
  
  // Get the appropriate unit label based on unit system
  const displayUnit = showUnit ? getUnitLabel(unit, unitSystem) : '';
  
  return (
    <Text style={style}>
      {formattedValue}{showUnit ? ` ${displayUnit}` : ''}
    </Text>
  );
};

export default UnitDisplay; 