import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Pressable, Modal } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons'; 
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { useRealtimeStatus, RealtimeStatus } from '../context/RealtimeStatusContext'; 
import Toast from 'react-native-toast-message'; 
import { appLogger } from '../services/AppLogService'; 
import { useTranslation } from 'react-i18next'; 

interface AppHeaderProps {
  title?: string;
  showBackButton?: boolean;
  showMenuButton?: boolean;
  onProfilePress?: () => void;
  onMenuPress?: () => void;
  rightComponent?: React.ReactNode;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  title = 'FoodWeb',
  showBackButton = false,
  showMenuButton = false,
  onProfilePress,
  onMenuPress,
  rightComponent,
}) => {
  const navigation = useNavigation();
  const { status, error: realtimeError, isAttemptingRetry } = useRealtimeStatus();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const prevStatusRef = useRef<RealtimeStatus | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (prevStatusRef.current === status && status !== 'ERROR' && status !== 'DISCONNECTED') return; 

    appLogger.log(`[AppHeader] Realtime status: ${status}, Previous: ${prevStatusRef.current}, Error: ${realtimeError}, Retrying: ${isAttemptingRetry}`);

    // Clear existing toasts to prevent stacking if status changes rapidly
    // Toast.hide(); // Be cautious with this, might hide legitimate sequential toasts too quickly.

    if (status === 'ERROR') {
      Toast.show({
        type: 'error',
        text1: t('header_toast_connectionError_title'),
        text2: t('toast_unableToSync'),
        visibilityTime: 5000,
        autoHide: true,
      });
    } else if (status === 'DISCONNECTED') {
      Toast.show({
        type: 'error',
        text1: t('header_toast_disconnected_title'),
        text2: t('toast_unableToSync'),
        visibilityTime: 5000,
        autoHide: true,
      });
    } else if (status === 'CONNECTING' && isAttemptingRetry) {
      Toast.show({
        type: 'info',
        text1: 'Reconnecting...',
        text2: 'Attempting to restore connection.',
        visibilityTime: 3000, // Shorter for reconnecting attempts
        autoHide: true,
      });
    } else if (status === 'CONNECTED' && 
               (prevStatusRef.current === 'DISCONNECTED' || 
                prevStatusRef.current === 'ERROR' || 
                (prevStatusRef.current === 'CONNECTING' && isAttemptingRetry))) {
      Toast.show({
        type: 'success',
        text1: t('header_toast_reconnected_title'),
        text2: t('header_toast_reconnected_message'),
        visibilityTime: 3000,
        autoHide: true,
      });
    }
    prevStatusRef.current = status;
  }, [status, realtimeError, isAttemptingRetry, t]);

  const renderRealtimeStatusIcon = () => {
    // Do not show icon if connected, or initializing, or connecting for the first time (not a retry)
    if (status === 'CONNECTED' || status === 'INITIALIZING' || (status === 'CONNECTING' && !isAttemptingRetry) ) {
      return null; 
    }

    let iconName: keyof typeof Ionicons.glyphMap = 'cloud-offline-outline';
    let iconColor = COLORS.warning; 

    if (status === 'ERROR') {
      iconName = 'alert-circle'; // Using filled for more emphasis
      iconColor = COLORS.error;
    } else if (status === 'DISCONNECTED') {
      iconName = 'cloud-offline'; // Using filled for more emphasis
      iconColor = COLORS.error;
    } else if (status === 'CONNECTING' && isAttemptingRetry) {
        iconName = 'sync-circle-outline'; 
        iconColor = COLORS.info; // Using info color for reconnecting attempts
    }

    return (
      <TouchableOpacity onPress={() => setTooltipVisible(true)} style={styles.statusIconContainer}>
        <Ionicons name={iconName} size={28} color={iconColor} />
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View style={styles.header}>
        <View style={styles.leftContainer}>
          {showBackButton ? (
            <TouchableOpacity 
              style={styles.buttonStyle}
              onPress={() => navigation.goBack()}
            >
              <MaterialCommunityIcons 
                name="arrow-left" 
                size={32} 
                color={COLORS.white} 
              />
            </TouchableOpacity>
          ) : showMenuButton ? (
            <TouchableOpacity 
              style={styles.buttonStyle}
              onPress={onMenuPress || (() => {})}
            >
              <MaterialCommunityIcons 
                name="menu" 
                size={32} 
                color={COLORS.white} 
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.buttonStyle}
              onPress={onProfilePress || (() => {})}
            >
              <MaterialCommunityIcons 
                name="account-circle" 
                size={36} 
                color={COLORS.white} 
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.centerContainer}>
          <Text 
            style={styles.titleText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        </View>

        <View style={styles.rightContainer}>
          {renderRealtimeStatusIcon()}
          {rightComponent && <View style={styles.rightComponentWrapper}>{rightComponent}</View>}
        </View>
      </View>

      {/* Tooltip Modal */}
      <Modal
        transparent={true}
        visible={tooltipVisible}
        onRequestClose={() => setTooltipVisible(false)}
        animationType="fade"
      >
        <Pressable style={styles.tooltipOverlay} onPress={() => setTooltipVisible(false)}>
          <View style={styles.tooltipContainer}>
            <Text style={styles.tooltipTitle}>
              {status === 'ERROR' ? t('header_toast_connectionError_title') : 
               status === 'DISCONNECTED' ? t('header_toast_disconnected_title') : 
               status === 'CONNECTING' && isAttemptingRetry ? 'Reconnecting...' : 'Connection Status'}
            </Text>
            <Text style={styles.tooltipText}>
              {status === 'ERROR' && (realtimeError || t('toast_unableToSync'))}
              {status === 'DISCONNECTED' && t('toast_unableToSync')}
              {status === 'CONNECTING' && isAttemptingRetry && 'Attempting to re-establish the connection to the server.'}
            </Text>
            <TouchableOpacity onPress={() => setTooltipVisible(false)} style={styles.tooltipCloseButton}>
              <Text style={styles.tooltipCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 0.75, 
    paddingVertical: SIZES.padding * 0.75, 
    backgroundColor: COLORS.background, 
    // ...SHADOWS.medium, 
  },
  leftContainer: {
    minWidth: 46, 
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SIZES.base * 0.5, 
  },
  rightContainer: {
    minWidth: 46, 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  statusIconContainer: {
    paddingHorizontal: SIZES.base * 0.75, 
    // marginRight: SIZES.base /2, 
  },
  rightComponentWrapper: {
    // marginLeft: SIZES.base / 2, 
  },
  titleText: {
    ...FONTS.h2,
    color: COLORS.white,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonStyle: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tooltipContainer: {
    backgroundColor: COLORS.surface || '#2C2C2E', 
    padding: SIZES.padding * 1.5,
    borderRadius: SIZES.radius,
    ...SHADOWS.dark,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  tooltipTitle: {
    ...FONTS.h3,
    color: COLORS.white,
    marginBottom: SIZES.base,
    fontWeight: 'bold',
  },
  tooltipText: {
    ...FONTS.body3,
    color: COLORS.lightGray || '#E0E0E0', 
    textAlign: 'center',
    marginBottom: SIZES.padding,
    lineHeight: FONTS.body3.fontSize * 1.4, 
  },
  tooltipCloseButton: {
    marginTop: SIZES.base,
    backgroundColor: COLORS.primary || '#007AFF', 
    paddingVertical: SIZES.base * 1.2,
    paddingHorizontal: SIZES.padding * 1.5,
    borderRadius: SIZES.radius,
  },
  tooltipCloseButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: 'bold',
  }
});

export default AppHeader;