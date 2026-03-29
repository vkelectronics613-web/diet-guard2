import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart } from 'react-native-chart-kit';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const AppContext = createContext(null);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const STORAGE_KEYS = {
  users: 'junkguard_users',
  session: 'junkguard_session',
  orderHistory: 'junkguard_order_history',
};

const GEMINI_API_KEY = 'AIzaSyA6g7ipVq8pW9GpthZrT9pjPwhaWxavA0c';

const APP_OPTIONS = [
  { id: 'swiggy', label: 'Swiggy', emoji: '🛵' },
  { id: 'zomato', label: 'Zomato', emoji: '🍽️' },
  { id: 'dominos', label: 'Dominos', emoji: '🍕' },
  { id: 'blinkit', label: 'Blinkit', emoji: '⚡' },
  { id: 'zepto', label: 'Zepto', emoji: '🛒' },
];

const FOOD_TABLE = [
  { name: 'pizza', category: 'Junk' },
  { name: 'burger', category: 'Junk' },
  { name: 'french fries', category: 'Junk' },
  { name: 'fries', category: 'Junk' },
  { name: 'fried chicken', category: 'Junk' },
  { name: 'chips', category: 'Junk' },
  { name: 'ice cream', category: 'Junk' },
  { name: 'donut', category: 'Junk' },
  { name: 'cake', category: 'Junk' },
  { name: 'soft drink', category: 'Junk' },
  { name: 'soda', category: 'Junk' },
  { name: 'cola', category: 'Junk' },
  { name: 'shawarma', category: 'Junk' },
  { name: 'instant noodles', category: 'Junk' },
  { name: 'white sauce pasta', category: 'Junk' },
  { name: 'samosa', category: 'Junk' },
  { name: 'kfc bucket', category: 'Junk' },
  { name: 'salad', category: 'Healthy' },
  { name: 'fruit bowl', category: 'Healthy' },
  { name: 'oats', category: 'Healthy' },
  { name: 'smoothie bowl', category: 'Healthy' },
  { name: 'grilled chicken', category: 'Healthy' },
  { name: 'brown rice bowl', category: 'Healthy' },
  { name: 'idli', category: 'Healthy' },
  { name: 'upma', category: 'Healthy' },
  { name: 'poha', category: 'Healthy' },
  { name: 'sprouts', category: 'Healthy' },
  { name: 'vegetable soup', category: 'Healthy' },
  { name: 'dal khichdi', category: 'Healthy' },
  { name: 'roti sabzi', category: 'Healthy' },
  { name: 'yogurt parfait', category: 'Healthy' },
  { name: 'protein bowl', category: 'Healthy' },
];

const MILESTONES = [5, 10, 30];

function useApp() {
  return useContext(AppContext);
}

function formatDate(date = new Date()) {
  return new Date(date).toISOString();
}

function sameDay(a, b) {
  if (!a || !b) return false;
  const first = new Date(a);
  const second = new Date(b);
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getFoodCategory(foodName) {
  const normalized = foodName.trim().toLowerCase();
  const matched = FOOD_TABLE.find(
    (item) =>
      normalized === item.name ||
      normalized.includes(item.name) ||
      item.name.includes(normalized)
  );
  if (matched) return matched.category;
  const healthyKeywords = ['salad', 'fruit', 'grilled', 'soup', 'oats', 'protein', 'roti'];
  const junkKeywords = ['pizza', 'burger', 'fries', 'cake', 'fried', 'cola', 'ice cream'];
  if (healthyKeywords.some((keyword) => normalized.includes(keyword))) return 'Healthy';
  if (junkKeywords.some((keyword) => normalized.includes(keyword))) return 'Junk';
  return 'Healthy';
}

function getHealthyAlternative(foodName) {
  const normalized = foodName.toLowerCase();
  if (normalized.includes('pizza')) return 'Try a veggie protein bowl or grilled sandwich instead.';
  if (normalized.includes('burger')) return 'Try a grilled wrap or paneer tikka salad instead.';
  if (normalized.includes('fries')) return 'Try roasted sweet potato wedges or corn chaat instead.';
  if (normalized.includes('ice cream') || normalized.includes('cake')) return 'Try a fruit bowl or yogurt parfait instead.';
  return 'Try a salad, soup, or protein bowl instead.';
}

async function loadJSON(key, fallback) {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

async function saveJSON(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function requestNotificationAccess() {
  if (!Device.isDevice) return { granted: false };
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return current;
  }
  const asked = await Notifications.requestPermissionsAsync();
  if (asked.granted) {
    await Notifications.setNotificationChannelAsync('junkguard-main', {
      name: 'JunkGuard Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E53935',
    });
  }
  return asked;
}

async function openUsageAccessSettings() {
  return IntentLauncher.startActivityAsync('android.settings.USAGE_ACCESS_SETTINGS');
}

async function openOverlaySettings() {
  return IntentLauncher.startActivityAsync('android.settings.action.MANAGE_OVERLAY_PERMISSION');
}

async function analyzeFoodWithGemini({ foodName, imageBase64 }) {
  const prompt = [
    'Classify the food as exactly one of these labels: Junk or Healthy.',
    'Respond with strict JSON only in this shape: {"category":"Junk|Healthy","reason":"short reason","identifiedFood":"name"}',
    foodName ? `User text input: ${foodName}` : 'No text input provided.',
    imageBase64 ? 'An image is attached for analysis.' : 'No image attached.',
  ].join('\n');

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          ...(imageBase64
            ? [
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: imageBase64,
                  },
                },
              ]
            : []),
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini response did not include analysis text.');
  }

  const parsed = JSON.parse(rawText);
  const category = parsed?.category === 'Junk' ? 'Junk' : 'Healthy';
  return {
    category,
    reason: parsed?.reason || 'AI analysis completed.',
    identifiedFood: parsed?.identifiedFood || foodName || 'Food item',
    source: 'gemini',
  };
}

async function analyzeFood({ foodName, imageBase64 }) {
  const textValue = foodName?.trim() || '';
  const canUseGemini = !!GEMINI_API_KEY && (textValue || imageBase64);
  if (canUseGemini) {
    try {
      return await analyzeFoodWithGemini({ foodName: textValue, imageBase64 });
    } catch (error) {
      console.log('Gemini analysis failed, falling back to keyword match.', error?.message || error);
    }
  }

  const category = getFoodCategory(textValue || 'food');
  return {
    category,
    reason: 'Classified using local keyword matching.',
    identifiedFood: textValue || 'Food item',
    source: 'keyword',
  };
}

async function sendFoodNotification(category, foodName) {
  const message =
    category === 'Junk'
      ? '⚠️ Are you sure to order junkfoods? This may harm you.'
      : '✅ Good choice!';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: category === 'Junk' ? 'JunkGuard Warning' : 'JunkGuard Praise',
      body: `${message} (${foodName})`,
      sound: false,
      data: { category, foodName },
    },
    trigger: null,
  });
}

function buildWeeklyStats(orderHistory, userId) {
  return [...Array(7)].map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      label: date.toISOString().slice(5, 10),
      value: orderHistory.filter(
        (item) => item.userId === userId && sameDay(item.date, date) && item.category === 'Healthy'
      ).length,
    };
  });
}

function ScreenShell({ children, scrollable = false }) {
  const content = (
    <View style={styles.shell}>
      <StatusBar style="dark" />
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {scrollable ? <ScrollView contentContainerStyle={styles.scrollContent}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

function FormField({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function PillButton({ label, onPress, variant = 'primary', disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.pillButton,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        disabled && styles.disabledButton,
      ]}
    >
      <Text style={[styles.pillButtonText, variant === 'primary' ? styles.primaryButtonText : styles.secondaryButtonText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

function AuthScreen({ navigation, route }) {
  const { users, loginUser, registerUser } = useApp();
  const isSignup = route.name === 'Sign Up';
  const [mode, setMode] = useState('email');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');

  async function handleEmailAuth() {
    if (!contact || !password || (isSignup && !name)) {
      Alert.alert('Missing details', 'Please complete all required fields.');
      return;
    }
    if (isSignup) {
      const result = await registerUser({
        name: name.trim(),
        email: contact.trim().toLowerCase(),
        password,
        phone: '',
      });
      if (!result.ok) {
        Alert.alert('Account exists', result.message);
      }
      return;
    }
    const result = await loginUser({ contact: contact.trim(), password });
    if (!result.ok) {
      Alert.alert('Login failed', result.message);
    }
  }

  async function handleOtpFlow() {
    if (!contact) {
      Alert.alert('Phone required', 'Please enter your phone number first.');
      return;
    }
    if (!generatedOtp) {
      const code = `${Math.floor(100000 + Math.random() * 900000)}`;
      setGeneratedOtp(code);
      Alert.alert('Demo OTP', `Use this OTP to continue: ${code}`);
      return;
    }
    if (otp !== generatedOtp) {
      Alert.alert('Invalid OTP', 'Please enter the same OTP shown in the demo alert.');
      return;
    }
    if (isSignup) {
      if (!name) {
        Alert.alert('Name required', 'Please enter your name to create the account.');
        return;
      }
      const result = await registerUser({
        name: name.trim(),
        phone: contact.trim(),
        email: '',
        password: '',
      });
      if (!result.ok) {
        Alert.alert('Account exists', result.message);
      }
      return;
    }
    const result = await loginUser({ contact: contact.trim(), otpVerified: true });
    if (!result.ok) {
      Alert.alert('Login failed', result.message);
    }
  }

  return (
    <ScreenShell>
      <LinearGradient colors={['#FFF7ED', '#FEF2F2']} style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>JunkGuard</Text>
        <Text style={styles.heroTitle}>Catch junk orders before they catch up with you.</Text>
        <Text style={styles.heroSubtitle}>
          Monitor your food apps, protect your streak, and turn better eating into a game.
        </Text>
      </LinearGradient>

      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segmentButton, mode === 'email' && styles.segmentButtonActive]}
          onPress={() => {
            setMode('email');
            setGeneratedOtp('');
            setOtp('');
          }}
        >
          <Text style={[styles.segmentText, mode === 'email' && styles.segmentTextActive]}>Email & Password</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentButton, mode === 'phone' && styles.segmentButtonActive]}
          onPress={() => {
            setMode('phone');
            setGeneratedOtp('');
            setOtp('');
          }}
        >
          <Text style={[styles.segmentText, mode === 'phone' && styles.segmentTextActive]}>Phone & OTP</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{route.name}</Text>
        {isSignup ? <FormField label="Name" value={name} onChangeText={setName} placeholder="Enter your full name" /> : null}
        <FormField
          label={mode === 'email' ? 'Email' : 'Phone'}
          value={contact}
          onChangeText={setContact}
          placeholder={mode === 'email' ? 'name@example.com' : 'Enter phone number'}
          keyboardType={mode === 'email' ? 'email-address' : 'phone-pad'}
        />

        {mode === 'email' ? (
          <>
            <FormField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              secureTextEntry
            />
            <PillButton label={isSignup ? 'Create Account' : 'Log In'} onPress={handleEmailAuth} />
          </>
        ) : (
          <>
            <FormField
              label="OTP"
              value={otp}
              onChangeText={setOtp}
              placeholder="Enter 6-digit OTP"
              keyboardType="number-pad"
            />
            <PillButton label={generatedOtp ? 'Verify OTP' : 'Send OTP'} onPress={handleOtpFlow} />
          </>
        )}

        <Text style={styles.disclaimerText}>
          Google sign-in is disabled in this build. Use email/password or phone OTP.
        </Text>
      </View>

      <Pressable onPress={() => navigation.navigate(isSignup ? 'Login' : 'Sign Up')} style={styles.footerLink}>
        <Text style={styles.footerLinkText}>
          {isSignup ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
        </Text>
      </Pressable>

      {!!users.length ? (
        <Text style={styles.disclaimerText}>
          Phone OTP is implemented as a local demo flow because no SMS backend is configured in this project.
        </Text>
      ) : null}
    </ScreenShell>
  );
}

function PermissionsScreen({ navigation }) {
  const { currentUser, updateUser } = useApp();
  const [notificationWanted, setNotificationWanted] = useState(true);

  async function handleContinue() {
    let granted = currentUser.notificationPermissionGranted;
    if (notificationWanted && !granted) {
      const result = await requestNotificationAccess();
      granted = !!result.granted;
      if (!granted) {
        Alert.alert('Notifications not granted', 'You can still use the app, but system alerts may not appear.');
      }
    }
    const nextUser = {
      ...currentUser,
      notificationPermissionGranted: granted,
      usageAccessRequested: true,
      overlayPermissionRequested: true,
      permissionsAsked: true,
    };
    await updateUser(nextUser);
    navigation.replace('Diet Goal');
  }

  return (
    <ScreenShell>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Permissions</Text>
        <Text style={styles.helperText}>
          Diet Guard monitors selected food apps to warn you before junk purchases. Your personal data stays private.
        </Text>

        <View style={styles.permissionRow}>
          <View style={styles.permissionTextWrap}>
            <Text style={styles.permissionTitle}>Notifications</Text>
            <Text style={styles.permissionBody}>
              Enable supportive reminders and order warnings.
            </Text>
          </View>
          <PillButton
            label={notificationWanted ? 'Will Request' : 'Skip'}
            onPress={() => setNotificationWanted((value) => !value)}
            variant="secondary"
          />
        </View>

        <View style={styles.permissionNotice}>
          <Text style={styles.permissionNoticeTitle}>Usage Access</Text>
          <Text style={styles.permissionNoticeBody}>
            Android treats app monitoring as a special access permission. Tap below, then enable Diet Guard in the Usage Access screen.
          </Text>
          <PillButton label="Open Usage Access" onPress={openUsageAccessSettings} variant="secondary" />
        </View>

        <View style={styles.permissionNotice}>
          <Text style={styles.permissionNoticeTitle}>Display Over Other Apps</Text>
          <Text style={styles.permissionNoticeBody}>
            Overlay permission is also a special access setting. Enable it so Diet Guard can show a calm reminder above food apps.
          </Text>
          <PillButton label="Open Overlay Settings" onPress={openOverlaySettings} variant="secondary" />
        </View>

        <PillButton label="Grant Permissions" onPress={handleContinue} />
        <PillButton label="Skip for Now" onPress={handleContinue} variant="secondary" />
      </View>
    </ScreenShell>
  );
}

function DietGoalScreen({ navigation }) {
  const { currentUser, updateUser } = useApp();
  const options = [7, 14, 21, 30, 60, 90];
  const [goal, setGoal] = useState(currentUser.dietGoalDays || 21);

  async function handleContinue() {
    await updateUser({ ...currentUser, dietGoalDays: goal });
    navigation.replace('Junk Limit');
  }

  return (
    <ScreenShell>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Set Discipline Goal</Text>
        <Text style={styles.helperText}>How many days discipline challenge?</Text>
        <View style={styles.optionWrap}>
          {options.map((value) => (
            <Pressable
              key={value}
              onPress={() => setGoal(value)}
              style={[styles.optionChip, goal === value && styles.optionChipActive]}
            >
              <Text style={[styles.optionText, goal === value && styles.optionTextActive]}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <PillButton label="Continue" onPress={handleContinue} />
      </View>
    </ScreenShell>
  );
}

function JunkLimitScreen({ navigation }) {
  const { currentUser, updateUser } = useApp();
  const options = [0, 1, 2, 3];
  const [limit, setLimit] = useState(
    typeof currentUser.weeklyJunkLimit === 'number' ? currentUser.weeklyJunkLimit : 1
  );

  async function handleContinue() {
    await updateUser({
      ...currentUser,
      weeklyJunkLimit: limit,
      weeklyJunkUsed: currentUser.weeklyJunkUsed || 0,
    });
    navigation.replace('Main');
  }

  return (
    <ScreenShell>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Junk Food Limit</Text>
        <Text style={styles.helperText}>How many junk meals will you allow yourself weekly?</Text>
        <Text style={styles.helperText}>Small limits work better than total restriction.</Text>
        <View style={styles.optionWrap}>
          {options.map((value) => (
            <Pressable
              key={value}
              onPress={() => setLimit(value)}
              style={[styles.optionChip, limit === value && styles.optionChipActive]}
            >
              <Text style={[styles.optionText, limit === value && styles.optionTextActive]}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <PillButton label="Continue" onPress={handleContinue} />
      </View>
    </ScreenShell>
  );
}

function BlockScreen() {
  const { currentUser, updateUser } = useApp();
  const [selectedApps, setSelectedApps] = useState(currentUser.selectedApps || []);

  function toggleApp(appId) {
    setSelectedApps((current) =>
      current.includes(appId) ? current.filter((item) => item !== appId) : [...current, appId]
    );
  }

  async function handleSave() {
    if (!selectedApps.length) {
      Alert.alert('Select at least one app', 'Choose the apps you want JunkGuard to monitor.');
      return;
    }
    await updateUser({ ...currentUser, selectedApps });
    Alert.alert('Protection active', 'Diet Guard will use these selected food apps for monitoring guidance.');
  }

  return (
    <ScreenShell>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Block Temptations</Text>
        <Text style={styles.helperText}>Select the food apps you want Diet Guard to monitor with reminders and discipline nudges.</Text>
        <View style={styles.selectGrid}>
          {APP_OPTIONS.map((app) => {
            const active = selectedApps.includes(app.id);
            return (
              <Pressable
                key={app.id}
                onPress={() => toggleApp(app.id)}
                style={[styles.selectCard, active && styles.selectCardActive]}
              >
                <Text style={styles.selectEmoji}>{app.emoji}</Text>
                <Text style={[styles.selectLabel, active && styles.selectLabelActive]}>{app.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <PillButton label="Activate Protection" onPress={handleSave} />
        <Text style={styles.helperText}>Diet Guard will remind you when these apps are opened. It guides behavior, it does not hard-block apps.</Text>
      </View>
    </ScreenShell>
  );
}

function HomeScreen({ navigation }) {
  const { currentUser, orderHistory } = useApp();
  const { width } = useWindowDimensions();
  const weeklyStats = useMemo(() => buildWeeklyStats(orderHistory, currentUser.id), [orderHistory, currentUser.id]);
  const selectedApps = APP_OPTIONS.filter((app) => currentUser.selectedApps.includes(app.id));

  return (
    <ScreenShell scrollable>
      <LinearGradient colors={['#166534', '#4ADE80']} style={styles.streakBanner}>
        <Text style={styles.streakIcon}>🔥</Text>
        <Text style={styles.streakCount}>{currentUser.currentStreak}</Text>
        <Text style={styles.streakLabel}>Current Healthy Streak</Text>
      </LinearGradient>

      <View style={styles.rowWrap}>
        <View style={[styles.card, styles.halfCard]}>
          <Text style={styles.sectionLabel}>Last Order</Text>
          <Text
            style={[
              styles.orderStatus,
              currentUser.lastOrder?.category === 'Junk' ? styles.statusJunk : styles.statusHealthy,
            ]}
          >
            {currentUser.lastOrder
              ? `${currentUser.lastOrder.category} · ${currentUser.lastOrder.foodName}`
              : 'No orders yet'}
          </Text>
          <Text style={styles.helperText}>
            {currentUser.lastOrderDate
              ? new Date(currentUser.lastOrderDate).toLocaleString()
              : 'Your latest order summary will appear here.'}
          </Text>
        </View>
        <View style={[styles.card, styles.halfCard]}>
          <Text style={styles.sectionLabel}>Discipline Plan</Text>
          <Text style={styles.orderStatus}>Goal: {currentUser.dietGoalDays || 0} days</Text>
          <Text style={styles.helperText}>
            Junk meals this week: {currentUser.weeklyJunkUsed || 0} / {currentUser.weeklyJunkLimit ?? 0}
          </Text>
          <Text
            style={[
              styles.orderStatus,
              (currentUser.weeklyJunkUsed || 0) >= (currentUser.weeklyJunkLimit ?? 0)
                ? styles.statusJunk
                : styles.statusHealthy,
            ]}
          >
            {(currentUser.weeklyJunkUsed || 0) >= (currentUser.weeklyJunkLimit ?? 0)
              ? 'Limit reached'
              : 'Within plan'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Selected Apps</Text>
          <View style={styles.iconWrap}>
            {selectedApps.map((app) => (
              <View key={app.id} style={styles.iconChip}>
                <Text style={styles.iconChipText}>{app.emoji} {app.label}</Text>
              </View>
            ))}
          </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly Healthy Stats</Text>
        {weeklyStats.some((entry) => entry.value > 0) ? (
          <LineChart
            data={{
              labels: weeklyStats.map((entry) => entry.label),
              datasets: [{ data: weeklyStats.map((entry) => entry.value) }],
            }}
            width={Math.max(width - 48, 280)}
            height={220}
            chartConfig={{
              backgroundGradientFrom: '#FFF7ED',
              backgroundGradientTo: '#FFFFFF',
              color: (opacity = 1) => `rgba(22, 101, 52, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
              decimalPlaces: 0,
              propsForDots: { r: '5', strokeWidth: '2', stroke: '#166534' },
            }}
            bezier
            style={styles.chart}
          />
        ) : (
          <EmptyState
            title="No healthy trend yet"
            subtitle="Healthy orders in the last 7 days will appear here."
          />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Milestone Badges</Text>
        <View style={styles.badgeRow}>
          {MILESTONES.map((badge) => {
            const unlocked = currentUser.currentStreak >= badge;
            return (
              <View key={badge} style={[styles.badge, unlocked ? styles.badgeUnlocked : styles.badgeLocked]}>
                <Text style={styles.badgeText}>{badge} Day{badge > 1 ? 's' : ''}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actions</Text>
        <PillButton label="Add New Order" onPress={() => navigation.navigate('Add Order')} />
        <PillButton label="Open Block Page" onPress={() => navigation.navigate('Main', { screen: 'BLOCK' })} variant="secondary" />
      </View>
    </ScreenShell>
  );
}

function GainScreen({ navigation }) {
  const recoveryFoods = [
    { name: 'Banana', benefit: 'Quick energy without the crash.' },
    { name: 'Nuts', benefit: 'Helps control cravings and keeps you full.' },
    { name: 'Curd', benefit: 'Cool, filling, and gut-friendly.' },
    { name: 'Salad', benefit: 'A reset meal that keeps you light.' },
    { name: 'Water', benefit: 'Many cravings shrink after hydration.' },
  ];
  const recoveryTasks = [
    { title: 'Drink Water', reward: 5 },
    { title: '5 Min Walk', reward: 10 },
    { title: 'Eat Fruit', reward: 15 },
    { title: 'Log Healthy Meal', reward: 10 },
    { title: 'Skip Next Craving', reward: 20 },
  ];

  return (
    <ScreenShell scrollable>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What Now</Text>
        <Text style={styles.helperText}>Recovery builds discipline. Pick a healthy next move.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>TO EAT</Text>
        {recoveryFoods.map((item) => (
          <View key={item.name} style={styles.recoveryRow}>
            <Text style={styles.orderStatus}>{item.name}</Text>
            <Text style={styles.helperText}>{item.benefit}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>TO DO</Text>
        {recoveryTasks.map((task) => (
          <View key={task.title} style={styles.recoveryRow}>
            <Text style={styles.orderStatus}>{task.title}</Text>
            <Text style={styles.helperText}>+{task.reward} coins</Text>
          </View>
        ))}
        <PillButton label="Add New Order" onPress={() => navigation.navigate('Add Order')} />
      </View>
    </ScreenShell>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#166534',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: '#FFFFFF',
        },
        tabBarLabelStyle: {
          fontWeight: '800',
          fontSize: 12,
        },
      }}
    >
      <Tab.Screen name="BLOCK" component={BlockScreen} />
      <Tab.Screen name="HOME" component={HomeScreen} />
      <Tab.Screen name="GAIN" component={GainScreen} />
    </Tab.Navigator>
  );
}

function AddOrderScreen({ navigation }) {
  const { currentUser, saveOrder } = useApp();
  const [selectedApp, setSelectedApp] = useState(currentUser.selectedApps[0] || '');
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [result, setResult] = useState(null);
  const [analysisReason, setAnalysisReason] = useState('');
  const [analysisSource, setAnalysisSource] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const availableApps = APP_OPTIONS.filter((app) => currentUser.selectedApps.includes(app.id));

  async function handleAnalyzeOrder() {
    if (!selectedApp || !foodName.trim()) {
      Alert.alert('Missing details', 'Please choose an app and enter a food name.');
      return;
    }
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeFood({ foodName: foodName.trim() });
      const resolvedFoodName = foodName.trim() || analysis.identifiedFood || 'Food item';
      const order = {
        id: `order_${Date.now()}`,
        userId: currentUser.id,
        app: selectedApp,
        foodName: resolvedFoodName,
        quantity: quantity.trim() || '1',
        category: analysis.category,
        date: formatDate(),
        analysisSource: analysis.source,
        analysisReason: analysis.reason,
      };
      const updatedUser = await saveOrder(order);
      setAnalysisReason(analysis.reason);
      setAnalysisSource(analysis.source);
      setResult({
        category: analysis.category,
        streak: updatedUser.currentStreak,
        message:
          analysis.category === 'Junk'
            ? '⚠️ Are you sure to order junkfoods? This may harm you.'
            : '✅ Good choice!',
        suggestion:
          analysis.category === 'Junk'
            ? getHealthyAlternative(resolvedFoodName)
            : 'You just extended your healthy momentum.',
        identifiedFood: resolvedFoodName,
      });
    } catch (error) {
      Alert.alert('Analysis failed', 'JunkGuard could not analyze this item right now. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <ScreenShell scrollable>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Manual Order Input</Text>
        <Text style={styles.helperText}>
          Enter the food name and Diet Guard will analyze it with Gemini AI and fall back to keyword matching if needed.
        </Text>

        <Text style={styles.label}>App</Text>
        <View style={styles.selectGrid}>
          {availableApps.map((app) => {
            const active = selectedApp === app.id;
            return (
              <Pressable
                key={app.id}
                onPress={() => setSelectedApp(app.id)}
                style={[styles.selectCard, active && styles.selectCardActive]}
              >
                <Text style={styles.selectEmoji}>{app.emoji}</Text>
                <Text style={[styles.selectLabel, active && styles.selectLabelActive]}>{app.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <FormField label="Food Name" value={foodName} onChangeText={setFoodName} placeholder="Ex: Burger, Salad, Poha" />
        <FormField
          label="Quantity (optional)"
          value={quantity}
          onChangeText={setQuantity}
          placeholder="1"
          keyboardType="number-pad"
        />

        {isAnalyzing ? (
          <View style={styles.analysisLoader}>
            <ActivityIndicator size="small" color="#166534" />
            <Text style={styles.helperText}>Analyzing food with AI...</Text>
          </View>
        ) : null}

        <PillButton label="Analyze Order" onPress={handleAnalyzeOrder} disabled={isAnalyzing} />
      </View>

      {result ? (
        <View style={[styles.card, result.category === 'Junk' ? styles.resultJunk : styles.resultHealthy]}>
          <Text style={styles.cardTitle}>{result.category === 'Junk' ? 'Junk Warning' : 'Healthy Result'}</Text>
          <Text style={styles.resultMessage}>{result.message}</Text>
          <Text style={styles.resultSuggestion}>Detected item: {result.identifiedFood}</Text>
          <Text style={styles.resultSuggestion}>Analysis source: {analysisSource === 'gemini' ? 'Gemini AI' : 'Keyword matching'}</Text>
          <Text style={styles.resultSuggestion}>Why: {analysisReason}</Text>
          <Text style={styles.resultSuggestion}>{result.suggestion}</Text>
          <Text style={styles.resultSuggestion}>Current streak: {result.streak} 🔥</Text>
          <PillButton label="Back to Home" onPress={() => navigation.navigate('Main', { screen: 'HOME' })} />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Food Table</Text>
        <Text style={styles.helperText}>Prefilled foods classified as Junk or Healthy.</Text>
        <View style={styles.foodTable}>
          {FOOD_TABLE.map((item) => (
            <View key={`${item.name}-${item.category}`} style={styles.foodTableRow}>
              <Text style={styles.foodName}>{item.name}</Text>
              <Text style={item.category === 'Junk' ? styles.statusJunk : styles.statusHealthy}>{item.category}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [resultModal, setResultModal] = useState({ visible: false, category: 'Healthy', text: '' });

  useEffect(() => {
    (async () => {
      const [savedUsers, savedSession, savedOrders] = await Promise.all([
        loadJSON(STORAGE_KEYS.users, []),
        loadJSON(STORAGE_KEYS.session, null),
        loadJSON(STORAGE_KEYS.orderHistory, []),
      ]);
      setUsers(savedUsers);
      setOrderHistory(savedOrders);
      if (savedSession?.userId) {
        const matched = savedUsers.find((user) => user.id === savedSession.userId);
        if (matched) setCurrentUser(matched);
      }
      setIsReady(true);
    })();
  }, []);

  async function updateUser(nextUser) {
    const nextUsers = users.map((user) => (user.id === nextUser.id ? nextUser : user));
    setUsers(nextUsers);
    setCurrentUser(nextUser);
    await saveJSON(STORAGE_KEYS.users, nextUsers);
  }

  async function registerUser({ name, email, phone, password }) {
    const existing = users.find(
      (user) => (email && user.email === email) || (phone && user.phone === phone)
    );
    if (existing) return { ok: false, message: 'An account with that email or phone already exists.' };

    const newUser = {
      id: `user_${Date.now()}`,
      name,
      email,
      phone,
      selectedApps: [],
      currentStreak: 0,
      lastOrder: null,
      lastOrderDate: null,
      notificationPermissionGranted: false,
      storagePermissionGranted: false,
      usageAccessRequested: false,
      overlayPermissionRequested: false,
      dietGoalDays: null,
      weeklyJunkLimit: null,
      weeklyJunkUsed: 0,
      permissionsAsked: false,
      createdAt: formatDate(),
    };
    const nextUsers = [...users, newUser];
    setUsers(nextUsers);
    setCurrentUser(newUser);
    await saveJSON(STORAGE_KEYS.users, nextUsers);
    await saveJSON(STORAGE_KEYS.session, { userId: newUser.id });
    if (password) {
      await SecureStore.setItemAsync(`junkguard_password_${newUser.id}`, password);
    }
    return { ok: true };
  }

  async function loginUser({ contact, password, otpVerified = false }) {
    const user = users.find((item) => item.email === contact.toLowerCase() || item.phone === contact);
    if (!user) return { ok: false, message: 'No account found for this email or phone.' };

    if (!otpVerified) {
      const storedPassword = await SecureStore.getItemAsync(`junkguard_password_${user.id}`);
      if (storedPassword !== password) return { ok: false, message: 'Incorrect password.' };
    }

    setCurrentUser(user);
    await saveJSON(STORAGE_KEYS.session, { userId: user.id });
    return { ok: true };
  }

  async function saveOrder(order) {
    const nextOrderHistory = [order, ...orderHistory];
    const updatedUser = {
      ...currentUser,
      currentStreak: order.category === 'Healthy' ? currentUser.currentStreak + 1 : 0,
      weeklyJunkUsed:
        order.category === 'Junk'
          ? (currentUser.weeklyJunkUsed || 0) + 1
          : currentUser.weeklyJunkUsed || 0,
      lastOrder: {
        app: order.app,
        foodName: order.foodName,
        category: order.category,
        analysisSource: order.analysisSource,
      },
      lastOrderDate: order.date,
    };
    setOrderHistory(nextOrderHistory);
    await saveJSON(STORAGE_KEYS.orderHistory, nextOrderHistory);
    await updateUser(updatedUser);
    await sendFoodNotification(order.category, order.foodName);
    setResultModal({
      visible: true,
      category: order.category,
      text:
        order.category === 'Junk'
          ? '⚠️ Are you sure to order junkfoods? This may harm you.'
          : '✅ Good choice!',
    });
    return updatedUser;
  }

  async function logout() {
    await AsyncStorage.removeItem(STORAGE_KEYS.session);
    setCurrentUser(null);
  }

  const appValue = {
    users,
    currentUser,
    orderHistory,
    registerUser,
    loginUser,
    updateUser,
    saveOrder,
    logout,
  };

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#FFF8F1',
      card: '#FFF8F1',
    },
  };

  if (!isReady) {
    return (
      <ScreenShell>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading JunkGuard...</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <AppContext.Provider value={appValue}>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#FFF8F1' },
            headerTitleStyle: { color: '#0F172A', fontWeight: '700' },
            contentStyle: { backgroundColor: '#FFF8F1' },
          }}
        >
          {!currentUser ? (
            <>
              <Stack.Screen name="Login" component={AuthScreen} />
              <Stack.Screen name="Sign Up" component={AuthScreen} />
            </>
          ) : !currentUser.permissionsAsked ? (
            <Stack.Screen name="Permissions" component={PermissionsScreen} />
          ) : !currentUser.dietGoalDays ? (
            <Stack.Screen name="Diet Goal" component={DietGoalScreen} />
          ) : currentUser.weeklyJunkLimit === null || currentUser.weeklyJunkLimit === undefined ? (
            <Stack.Screen name="Junk Limit" component={JunkLimitScreen} />
          ) : (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="Add Order" component={AddOrderScreen} />
              <Stack.Screen name="Diet Goal" component={DietGoalScreen} />
              <Stack.Screen name="Junk Limit" component={JunkLimitScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      <Modal visible={resultModal.visible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, resultModal.category === 'Junk' ? styles.modalJunk : styles.modalHealthy]}>
            <Text style={styles.modalTitle}>
              {resultModal.category === 'Junk' ? 'Order Warning' : 'Healthy Choice'}
            </Text>
            <Text style={styles.modalBody}>{resultModal.text}</Text>
            <PillButton
              label="Close"
              onPress={() => setResultModal({ visible: false, category: 'Healthy', text: '' })}
            />
          </View>
        </View>
      </Modal>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8F1',
  },
  shell: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroCard: {
    borderRadius: 28,
    padding: 24,
    gap: 10,
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#FDE68A',
    borderRadius: 18,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: '#111827',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 14,
    shadowColor: '#7C2D12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  input: {
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FFF7ED',
  },
  pillButton: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#166534',
  },
  secondaryButton: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FDA4AF',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#9F1239',
  },
  pillButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  footerLink: {
    alignItems: 'center',
  },
  footerLinkText: {
    color: '#9A3412',
    fontWeight: '700',
  },
  disclaimerText: {
    textAlign: 'center',
    color: '#78716C',
    fontSize: 12,
    lineHeight: 18,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  permissionTextWrap: {
    flex: 1,
    gap: 6,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  permissionBody: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  permissionNotice: {
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  permissionNoticeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#9A3412',
  },
  permissionNoticeBody: {
    color: '#7C2D12',
    fontSize: 13,
    lineHeight: 19,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    minWidth: 70,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
  },
  optionChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  optionText: {
    color: '#7C2D12',
    fontWeight: '800',
  },
  optionTextActive: {
    color: '#166534',
  },
  selectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectCard: {
    width: '48%',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  selectCardActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  selectEmoji: {
    fontSize: 28,
  },
  selectLabel: {
    color: '#7C2D12',
    fontWeight: '700',
  },
  selectLabelActive: {
    color: '#166534',
  },
  streakBanner: {
    borderRadius: 30,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  streakIcon: {
    fontSize: 36,
  },
  streakCount: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  streakLabel: {
    color: '#ECFDF5',
    fontWeight: '700',
    fontSize: 16,
  },
  rowWrap: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCard: {
    flex: 1,
  },
  orderStatus: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusHealthy: {
    color: '#15803D',
    fontWeight: '800',
  },
  statusJunk: {
    color: '#DC2626',
    fontWeight: '800',
  },
  iconWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconChip: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  iconChipText: {
    color: '#9A3412',
    fontWeight: '700',
  },
  chart: {
    borderRadius: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  badgeUnlocked: {
    backgroundColor: '#DCFCE7',
  },
  badgeLocked: {
    backgroundColor: '#E2E8F0',
  },
  badgeText: {
    color: '#0F172A',
    fontWeight: '800',
  },
  resultHealthy: {
    borderWidth: 2,
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  resultJunk: {
    borderWidth: 2,
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  resultMessage: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  resultSuggestion: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  photoActionRow: {
    gap: 10,
  },
  imagePreviewCard: {
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    padding: 12,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  analysisLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  foodTable: {
    gap: 10,
  },
  foodTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  foodName: {
    color: '#0F172A',
    textTransform: 'capitalize',
  },
  emptyCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    gap: 14,
  },
  modalHealthy: {
    borderWidth: 2,
    borderColor: '#16A34A',
  },
  modalJunk: {
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalBody: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
  },
});
