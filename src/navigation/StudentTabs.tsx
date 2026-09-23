import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import StudentDashboardScreen from '../screens/student/StudentDashboardScreen';
import StudentFindTeachersScreen from '../screens/student/StudentFindTeachersScreen';
import StudentMyTeachersScreen from '../screens/student/StudentMyTeachersScreen';
import StudyHelperScreen from '../screens/StudyHelperScreen';
import LanguageToggle from '../components/LanguageToggle';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import { useLanguage } from '../context/Language';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

export default function StudentTabs() {
  const { logout } = useFirebaseAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primaryLight,
        tabBarInactiveTintColor: colors.textDim,
        headerStyle: { backgroundColor: '#0b1024' },
        headerTintColor: colors.text,
        headerRight: () => (
          <View style={styles.headerRight}>
            <LanguageToggle />
            <TouchableOpacity
              onPress={async () => {
                await logout();
                navigation.reset({ index: 0, routes: [{ name: 'Home' as never }] });
              }}
            >
              <Text style={styles.logoutText}>{t('Log out')}</Text>
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Tab.Screen
        name="StudentDashboard"
        component={StudentDashboardScreen}
        options={{ title: t('Dashboard'), tabBarLabel: t('Dashboard') }}
      />
      <Tab.Screen
        name="FindTeachers"
        component={StudentFindTeachersScreen}
        options={{ title: t('Find Teachers'), tabBarLabel: t('Find') }}
      />
      <Tab.Screen
        name="MyTeachers"
        component={StudentMyTeachersScreen}
        options={{ title: t('My Teachers'), tabBarLabel: t('My Teachers') }}
      />
      <Tab.Screen
        name="StudyHelper"
        component={StudyHelperScreen}
        options={{ title: t('Study Helper'), tabBarLabel: t('Helper') }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16 },
  logoutText: { color: colors.dangerLight, fontWeight: '600' },
});
