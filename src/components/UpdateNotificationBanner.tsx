import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Assuming you use Expo icons
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the hook

interface UpdateNotificationBannerProps {
  visible: boolean;
  message?: string;
}

const UpdateNotificationBanner: React.FC<UpdateNotificationBannerProps> = ({
  visible,
  message = 'Page Updated',
}) => {
  const insets = useSafeAreaInsets(); // Get safe area insets
  // Adjust initial/hidden position based on estimated height (~40-50px)
  const hiddenTranslateY = -120; 
  const translateY = React.useRef(new Animated.Value(hiddenTranslateY)).current; // Start off-screen

  React.useEffect(() => {
    if (visible) {
      // Animate in
      Animated.timing(translateY, {
        toValue: 0, // Animate to top edge (it will be positioned below notch via style)
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Animate out - Use the calculated hidden position
      Animated.timing(translateY, {
        toValue: hiddenTranslateY, // Animate back off-screen
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY, hiddenTranslateY]); // Add hiddenTranslateY to deps

  return (
    <Animated.View
      style={[
        styles.banner,
        // Apply the top inset dynamically
        { top: insets.top, transform: [{ translateY }] }, 
      ]}
    >
      <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={styles.icon} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    // top: 0, // REMOVED - Now set dynamically using insets
    left: 0,
    right: 0,
    backgroundColor: '#4CAF50', // Green background
    paddingVertical: 10,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000, // Ensure it's on top
    // Add shadow for better visibility if needed
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default UpdateNotificationBanner; 