import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { formatQuantityAuto } from '../utils/textFormatters';
import { appLogger } from '../services/AppLogService';

interface ScaleSliderInputProps {
  label: string;
  minValue: number;
  maxValue: number;
  step: number;
  currentValue: number;
  displayValue: string; // Formatted value for the text input/display
  displaySuffix: string; // e.g., "x scale" or "Servings"
  onValueChange: (value: number) => void;
  onSlidingComplete: (value: number) => void;
  onTextInputChange: (text: string) => void; // Handler for direct text input
  containerStyle?: ViewStyle;
  /** @deprecated preparation yields removed – these will be ignored */
  yieldBase?: never;
  yieldUnitAbbr?: never;
  yieldItem?: never;
}

const ScaleSliderInput: React.FC<ScaleSliderInputProps> = ({
  label,
  minValue,
  maxValue,
  step,
  currentValue,
  displayValue,
  displaySuffix,
  onValueChange,
  onSlidingComplete,
  onTextInputChange,
  containerStyle,
  ..._deprecated
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controlsRow}>
        <Slider
          style={styles.slider}
          minimumValue={minValue}
          maximumValue={maxValue}
          step={step}
          value={currentValue}
          onValueChange={onValueChange} // Direct update during slide
          onSlidingComplete={onSlidingComplete} // Final rounding/update on release
          minimumTrackTintColor={COLORS.primary}
          maximumTrackTintColor={COLORS.border}
          thumbTintColor={COLORS.primary}
        />
        <TextInput
          style={styles.valueInput}
          value={displayValue}
          onChangeText={onTextInputChange}
          keyboardType="numeric"
          selectTextOnFocus
        />
        <Text style={styles.suffixLabel}>{displaySuffix}</Text>
      </View>
      {/* Yield display removed for preparations */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SIZES.padding,
    // Removed background color, handle in parent if needed
  },
  label: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginBottom: SIZES.base,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZES.padding / 2,
  },
  slider: {
    flex: 3, // Give slider more space
    height: 40,
  },
  valueInput: { // Input field with fixed width
    width: 55, // Make input narrower
    textAlign: 'center',
    backgroundColor: COLORS.surface,
    color: COLORS.white,
    paddingHorizontal: SIZES.base,
    paddingVertical: Platform.OS === 'ios' ? SIZES.base : SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: SIZES.padding,
    ...FONTS.body2,
  },
  suffixLabel: { // Label next to input
    ...FONTS.body3,
    color: COLORS.textLight,
    marginLeft: SIZES.base / 2,
    minWidth: 60, // Give it some minimum width
    textAlign: 'left',
  },
  // yieldText removed
});

export default ScaleSliderInput; 