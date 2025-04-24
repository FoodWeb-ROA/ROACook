import React, { useState } from 'react';
import {
	StyleSheet,
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ActivityIndicator,
	SafeAreaView
} from 'react-native';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useDispatch } from 'react-redux';
import { COLORS, FONTS, SHADOWS, SIZES } from '../constants/theme';
import { loginWatch, oauthWatch, registerWatch } from '../slices/authSlice';
import { ILanguage } from '../types';
import { MaterialIcons, FontAwesome5, AntDesign } from '@expo/vector-icons';
import { useTypedSelector } from '../hooks/useTypedSelector';
import LanguagePicker from '../components/LanguagePicker';

interface SignInValues {
	email: string;
	password: string;
}

interface SignUpValues {
	fullname: string;
	email: string;
	password: string;
	language: ILanguage['ISO_Code'];
}

const LoginScreen = () => {
	const dispatch = useDispatch();
	const [selectedForm, setSelectedForm] = useState<'SignIn' | 'SignUp'>(
		'SignIn'
	);

	const errorSelector = useTypedSelector(state => state.auth.error);

	const signInValidationSchema = Yup.object({
		email: Yup.string()
			.email('Invalid email address')
			.required('Email is required'),
		password: Yup.string().required('Password is required')
	});

	const signUpValidationSchema = Yup.object({
		fullname: Yup.string().required('Fullname is required'),
		email: Yup.string()
			.email('Invalid email address')
			.required('Email is required'),
		password: Yup.string()
			.min(6, 'Password must be at least 6 characters')
			.required('Password is required'),
		language: Yup.string()
			.oneOf(['EN', 'ES', 'FR', 'IT'], 'Invalid language')
			.required('Language is required')
	});

	const handleSubmit = (values: SignInValues | SignUpValues) => {
		if (selectedForm === 'SignIn') {
			console.log(`--- sign in/values:`, values);

			dispatch(
				loginWatch({
					...values
				})
			);
		} else {
			console.log(`--- sign up/values:`, values);

			dispatch(
				registerWatch({
					...(values as SignUpValues)
				})
			);
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<Text style={styles.superTitle}>ROA</Text>

			{/* Segmented Control */}
			<View style={styles.segmentedWrapper}>
				<View style={styles.segmentedControlContainer}>
					<TouchableOpacity
						style={[
							styles.segment,
							selectedForm === 'SignIn' && styles.segmentSelected
						]}
						onPress={() => setSelectedForm('SignIn')}
					>
						<Text
							style={[
								styles.segmentText,
								selectedForm === 'SignIn' && styles.segmentTextSelected
							]}
						>
							Sign In
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[
							styles.segment,
							selectedForm === 'SignUp' && styles.segmentSelected
						]}
						onPress={() => setSelectedForm('SignUp')}
					>
						<Text
							style={[
								styles.segmentText,
								selectedForm === 'SignUp' && styles.segmentTextSelected
							]}
						>
							Sign Up
						</Text>
					</TouchableOpacity>
				</View>
			</View>

			{/* Forms */}
			{selectedForm === 'SignIn' ? (
				<Formik<SignInValues>
					initialValues={{
						email: '',
						password: ''
					}}
					validationSchema={signInValidationSchema}
					onSubmit={handleSubmit}
				>
					{({
						handleChange,
						handleBlur,
						handleSubmit,
						values,
						errors,
						touched,
						isSubmitting
					}) => (
						<View style={styles.formContainer}>
							<Text style={styles.label}>Email</Text>
							<TextInput
								style={styles.input}
								placeholder="Email"
								onChangeText={handleChange('email')}
								onBlur={handleBlur('email')}
								value={values.email}
								placeholderTextColor={COLORS.placeholder}
								keyboardType="email-address"
								autoCapitalize="none"
							/>
							{touched.email && errors.email && (
								<Text style={styles.error}>{errors.email}</Text>
							)}

							<Text style={styles.label}>Password</Text>
							<TextInput
								style={styles.input}
								placeholder="Password"
								onChangeText={handleChange('password')}
								onBlur={handleBlur('password')}
								value={values.password}
								placeholderTextColor={COLORS.placeholder}
								secureTextEntry
							/>
							{touched.password && errors.password && (
								<Text style={styles.error}>{errors.password}</Text>
							)}

							<View style={styles.forgotContainer}>
								<TouchableOpacity
									style={styles.forgotButton}
									onPress={() => {}}
								>
									<Text style={styles.forgotTitle}>Forgot password?</Text>
								</TouchableOpacity>
							</View>

							{errorSelector !== null && (
								<Text style={styles.error}>{errorSelector}</Text>
							)}

							<TouchableOpacity
								style={styles.button}
								onPress={() => handleSubmit()}
								disabled={isSubmitting}
							>
								{isSubmitting ? (
									<ActivityIndicator
										size="small"
										color={COLORS.white}
									/>
								) : (
									<Text style={styles.buttonText}>Sign In</Text>
								)}
							</TouchableOpacity>
						</View>
					)}
				</Formik>
			) : (
				<Formik<SignUpValues>
					initialValues={{
						fullname: '',
						email: '',
						password: '',
						language: 'EN'
					}}
					validationSchema={signUpValidationSchema}
					onSubmit={handleSubmit}
				>
					{({
						handleChange,
						handleBlur,
						handleSubmit,
						values,
						errors,
						touched,
						isSubmitting
					}) => (
						<View style={styles.formContainer}>
							<Text style={styles.label}>Full Name</Text>
							<TextInput
								style={styles.input}
								placeholder="Full Name"
								onChangeText={handleChange('fullname')}
								onBlur={handleBlur('fullname')}
								value={values.fullname}
								placeholderTextColor={COLORS.placeholder}
							/>
							{touched.fullname && errors.fullname && (
								<Text style={styles.error}>{errors.fullname}</Text>
							)}

							<Text style={styles.label}>Email</Text>
							<TextInput
								style={styles.input}
								placeholder="Email"
								onChangeText={handleChange('email')}
								onBlur={handleBlur('email')}
								value={values.email}
								placeholderTextColor={COLORS.placeholder}
								keyboardType="email-address"
							/>
							{touched.email && errors.email && (
								<Text style={styles.error}>{errors.email}</Text>
							)}

							<Text style={styles.label}>Password</Text>
							<TextInput
								style={styles.input}
								placeholder="Password"
								onChangeText={handleChange('password')}
								onBlur={handleBlur('password')}
								value={values.password}
								placeholderTextColor={COLORS.placeholder}
								secureTextEntry
							/>
							{touched.password && errors.password && (
								<Text style={styles.error}>{errors.password}</Text>
							)}

							<LanguagePicker />
							{touched.language && errors.language && (
								<Text style={styles.error}>{errors.language}</Text>
							)}

							{errorSelector !== null && (
								<Text style={styles.error}>{errorSelector}</Text>
							)}

							<TouchableOpacity
								style={styles.button}
								onPress={() => handleSubmit()}
								disabled={isSubmitting}
							>
								{isSubmitting ? (
									<ActivityIndicator
										size="small"
										color={COLORS.white}
									/>
								) : (
									<Text style={styles.buttonText}>Sign Up</Text>
								)}
							</TouchableOpacity>
						</View>
					)}
				</Formik>
			)}

			{/* OAuth Buttons */}
			<View style={styles.oauthContainer}>
				{/* Azure Button */}
				{/* <TouchableOpacity
					style={[styles.oauthButton, { backgroundColor: COLORS.white }]}
					onPress={() => dispatch(oauthWatch({ provider: 'azure' }))}
				>
					<MaterialIcons
						name="cloud"
						size={24}
						color="#007FFF"
					/>
				</TouchableOpacity> */}

				{/* Google Button */}
				<TouchableOpacity
					style={[styles.oauthButton, { backgroundColor: COLORS.white }]}
					onPress={() => dispatch(oauthWatch({ provider: 'google' }))}
				>
					<AntDesign
						name="google"
						size={24}
						color="#DB4437"
					/>
				</TouchableOpacity>

				{/* Apple Button */}
				<TouchableOpacity
					style={[styles.oauthButton, { backgroundColor: COLORS.white }]}
					onPress={() => dispatch(oauthWatch({ provider: 'apple' }))}
				>
					<FontAwesome5
						name="apple"
						size={24}
						color="#000000"
					/>
				</TouchableOpacity>
			</View>
			{errorSelector !== null && <Text style={styles.error}>{errorSelector}</Text>}
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		backgroundColor: COLORS.background,
		paddingHorizontal: SIZES.padding,
		paddingVertical: SIZES.padding,
		width: '100%',
		alignItems: 'center',
		position: 'relative',
		height: '100%'
	},
	superTitle: {
		color: COLORS.text,
		...FONTS.h1,
		paddingTop: '10%',
		paddingBottom: SIZES.padding
	},
	segmentedWrapper: {
		paddingHorizontal: SIZES.padding
	},
	segmentedControlContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: SIZES.margin,
		borderWidth: SIZES.borderWidth,
		borderColor: COLORS.primary,
		borderRadius: SIZES.radius,
		alignSelf: 'stretch'
	},
	segment: {
		width: '50%',
		paddingVertical: SIZES.small,
		alignItems: 'center',
		borderRadius: SIZES.radius
	},
	segmentSelected: {
		backgroundColor: COLORS.primary,
		borderRadius: SIZES.radius
	},
	segmentText: {
		color: COLORS.primary,
		...FONTS.body2
	},
	segmentTextSelected: {
		color: COLORS.white,
		...FONTS.body2
	},
	formContainer: {
		width: '100%',
		paddingHorizontal: SIZES.padding
	},
	label: {
		...FONTS.body2,
		color: COLORS.textLight,
		marginBottom: SIZES.small
	},
	input: {
		width: '100%',
		borderWidth: SIZES.borderWidth,
		borderColor: COLORS.border,
		backgroundColor: COLORS.inputBackground,
		borderRadius: SIZES.radius,
		padding: SIZES.small,
		marginBottom: SIZES.margin,
		color: COLORS.text,
		...FONTS.body1
	},
	error: {
		color: COLORS.error,
		marginBottom: SIZES.base,
		...FONTS.body2
	},
	forgotContainer: {
		width: '100%',
		paddingHorizontal: SIZES.padding,
		display: 'flex',
		alignItems: 'flex-end',
		flex: 1,
		height: '100%'
	},
	forgotButton: {
		marginBottom: SIZES.margin
	},
	forgotTitle: {
		color: COLORS.textLight,
		...FONTS.body1
	},
	button: {
		backgroundColor: COLORS.primary,
		borderRadius: SIZES.radius,
		alignItems: 'center',
		padding: SIZES.medium,
		...SHADOWS.medium,
		marginTop: SIZES.margin
	},
	buttonText: {
		color: COLORS.white,
		fontWeight: 'bold',
		...FONTS.body1
	},
	oauthContainer: {
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center',
		marginTop: SIZES.padding,
		paddingHorizontal: SIZES.padding,
		position: 'absolute',
		bottom: SIZES.padding * 2
	},
	oauthButton: {
		width: 56,
		height: 56,
		borderRadius: 28,
		justifyContent: 'center',
		alignItems: 'center',
		...SHADOWS.medium
	}
});

export default LoginScreen;
