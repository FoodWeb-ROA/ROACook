import React, { useState } from 'react';
import {
	StyleSheet,
	View,
	Text,
	TouchableOpacity,
	FlatList
} from 'react-native';
import { useFormikContext } from 'formik';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

interface ILanguage {
	ISO_Code: string;
	name_in_language: string;
}

const languages: ILanguage[] = [
	{ ISO_Code: 'EN', name_in_language: 'English' },
	{ ISO_Code: 'ES', name_in_language: 'Español' },
	{ ISO_Code: 'FR', name_in_language: 'Français' },
	{ ISO_Code: 'IT', name_in_language: 'Italiano' }
];

const LanguagePicker: React.FC = () => {
	const { values, setFieldValue } = useFormikContext<{ language: string }>();
	const [isDropdownOpen, setDropdownOpen] = useState(false);
	const { t, i18n } = useTranslation();

	const toggleDropdown = () => setDropdownOpen(!isDropdownOpen);

	const renderItem = ({ item }: { item: ILanguage }) => (
		<TouchableOpacity
			style={styles.item}
			onPress={() => {
				setFieldValue('language', item.ISO_Code);
				setDropdownOpen(false);
			}}
		>
			<Text style={styles.itemText}>{item.name_in_language}</Text>
		</TouchableOpacity>
	);

	return (
		<View style={styles.container}>
			<Text style={styles.label}>{t('languageLabel', 'Language')}</Text>
			<TouchableOpacity
				style={styles.dropdown}
				onPress={toggleDropdown}
			>
				<Text style={styles.selectedText}>
					{languages.find(lang => lang.ISO_Code === values.language)
						?.name_in_language || t('components.languagePicker.selectLanguageFallback')}
				</Text>
				<MaterialIcons name="arrow-drop-down" size={24} color={COLORS.text} />
			</TouchableOpacity>
			{isDropdownOpen && (
				<FlatList
					data={languages}
					keyExtractor={item => item.ISO_Code}
					renderItem={renderItem}
					style={styles.dropdownList}
				/>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		marginBottom: SIZES.margin,
		// backgroundColor: COLORS.inputBackground,
		// padding: SIZES.padding,
		borderRadius: SIZES.radius
	},
	label: {
		...FONTS.body2,
		color: COLORS.textLight,
		marginBottom: SIZES.small
	},
	dropdown: {
		backgroundColor: COLORS.surface,
		padding: SIZES.small,
		borderRadius: SIZES.radius,
		borderWidth: SIZES.borderWidth,
		borderColor: COLORS.border,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between'
	},
	selectedText: {
		...FONTS.body2,
		color: COLORS.text
	},
	dropdownList: {
		marginTop: SIZES.small,
		backgroundColor: COLORS.surface,
		borderRadius: SIZES.radius,
		paddingVertical: SIZES.small,
		maxHeight: 160
	},
	item: {
		display: 'flex',
		alignSelf: 'center',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: SIZES.base,
		paddingHorizontal: SIZES.small
	},
	itemText: {
		...FONTS.body2,
		color: COLORS.text
	}
});

export default LanguagePicker;
