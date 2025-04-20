import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Dish, DishComponent } from '../types';
import { COLORS, SIZES, SHADOWS, FONTS } from '../constants/theme';
import { useTranslation } from 'react-i18next';

interface DishCardProps {
  dish: Dish;
  onPress: (dish: Dish) => void;
}

const formatTime = (interval: string | null): string => {
  if (!interval) return 'N/A';
  if (interval.startsWith('PT')) {
      const match = interval.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      if (match) {
          const hours = parseInt(match[1] || '0');
          const minutes = parseInt(match[2] || '0');
          if (hours > 0) return `${hours}h ${minutes}m`;
          return `${minutes} min`;
      }
  }
  const parts = interval.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
  }
  return interval;
};

const DishCard: React.FC<DishCardProps> = ({ dish, onPress }) => {
  const { t } = useTranslation();
  
  console.log('Dish card components:', dish.components);
  
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress(dish)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: dish.imageUrl || 'https://via.placeholder.com/150' }} 
        style={styles.image} 
      />
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={1}>{dish.dish_name}</Text>
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.textLight} />
            <Text style={styles.detailText}>{formatTime(dish.total_time)}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="account-multiple" size={16} color={COLORS.textLight} />
            <Text style={styles.detailText}>{t('components.dishCard.servings', { count: dish.num_servings || 0 })}</Text>
          </View>
          {dish.serving_size && dish.serving_unit && (
            <View style={styles.detailRow}>
              <Text style={styles.detailText}>{dish.serving_size} {dish.serving_unit.abbreviation || dish.serving_unit.unit_name}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.componentsContainer}>
          <Text style={styles.componentsTitle}>{t('components.dishCard.componentsTitle')}</Text>
          {dish.components && dish.components.length > 0 ? (
            <View style={styles.componentsList}>
              {dish.components.slice(0, 4).map((component, index) => (
                <View 
                  key={`${component.ingredient_id}-${index}`} 
                  style={styles.componentPill}
                >
                  <Text style={styles.componentText}>
                    {component.name}
                  </Text>
                </View>
              ))}
              {dish.components.length > 4 && (
                <View 
                  style={[styles.componentPill, styles.morePill]}
                >
                  <Text style={styles.componentText}>
                    +{dish.components.length - 4} more
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.noComponentsText}>{t('components.dishCard.noComponentsText')}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.padding,
    ...SHADOWS.medium,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  infoContainer: {
    padding: SIZES.padding,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 8,
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 4,
    fontSize: 12,
    color: COLORS.textLight,
  },
  componentsContainer: {
    marginTop: 12,
  },
  componentsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.white,
    marginBottom: 8,
  },
  componentsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    marginHorizontal: -4,
  },
  componentPill: {
    backgroundColor: COLORS.tertiary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    margin: 4,
    ...SHADOWS.small,
  },
  componentText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '500',
  },
  morePill: {
    backgroundColor: COLORS.primary,
  },
  noComponentsText: {
    fontStyle: 'italic',
    fontSize: 14,
    color: COLORS.textLight,
  },
});

export default DishCard; 