import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Dish, DishComponent } from '../types';
import { COLORS, SIZES, SHADOWS, FONTS } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import { relative } from 'path';
import { appLogger } from '../services/AppLogService';

interface DishCardProps {
  dish: Dish;
  onPress: (dish: Dish) => void;
  onPreparationPress?: (preparationId: string) => void;
  onDelete?: (dishId: string) => void;
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

const DishCard: React.FC<DishCardProps> = ({ dish, onPress, onPreparationPress, onDelete }) => {
  const { t } = useTranslation();
  
  // Filter to only include preparations
  const preparations = dish.components ? dish.components.filter(comp => comp.isPreparation) : [];

  const handleDelete = () => {
    if (onDelete) {
      Alert.alert(
        t('common.confirmDelete', 'Confirm Delete'),
        dish.dish_name,
        [
          {
            text: t('common.cancel', 'Cancel'),
            style: 'cancel',
          },
          {
            text: t('common.delete', 'Delete'),
            style: 'destructive',
            onPress: () => onDelete(dish.dish_id),
          },
        ]
      );
    }
  };
  
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
        
        <View style={styles.preparationsContainer}>
          <Text style={styles.preparationsTitle}>{t('components.dishCard.preparationsTitle', 'Preparations')}</Text>
          {preparations.length > 0 ? (
            <View style={styles.preparationsList}>
              {preparations.slice(0, 4).map((preparation, index) => (
                <TouchableOpacity 
                  key={`${preparation.ingredient_id}-${index}`} 
                  style={styles.preparationPill}
                  onPress={() => onPreparationPress && onPreparationPress(preparation.ingredient_id)}
                  disabled={!onPreparationPress}
                >
                  <Text style={styles.preparationText}>
                    {preparation.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {preparations.length > 4 && (
                <View 
                  style={[styles.preparationPill, styles.morePill]}
                >
                  <Text style={styles.preparationText}>
                    +{preparations.length - 4} more
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.noPreparationsText}>{t('components.dishCard.noPreparationsText', 'No preparations')}</Text>
          )}
        </View>

        {onDelete && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
            <MaterialCommunityIcons name="delete" size={20} color={COLORS.error} />
          </TouchableOpacity>
        )}
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
    position: 'relative'
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
  preparationsContainer: {
    marginTop: 12,
  },
  preparationsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.white,
    marginBottom: 8,
  },
  preparationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    marginHorizontal: -4,
  },
  preparationPill: {
    backgroundColor: COLORS.tertiary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    margin: 4,
    ...SHADOWS.small,
  },
  preparationText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '500',
  },
  morePill: {
    backgroundColor: COLORS.primary,
  },
  noPreparationsText: {
    fontStyle: 'italic',
    fontSize: 14,
    color: COLORS.textLight,
  },
  deleteButton: {
    position: 'absolute',
    bottom: SIZES.padding,
    right: SIZES.padding,
    width: SIZES.base * 4,
    height: SIZES.base * 4,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default DishCard; 