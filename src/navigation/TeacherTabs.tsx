import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import TeacherDashboardScreen from '../screens/teacher/TeacherDashboardScreen';
import TeacherStudentsScreen from '../screens/teacher/TeacherStudentsScreen';
import TeacherProfileScreen from '../screens/teacher/TeacherProfileScreen';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

export default function TeacherTabs() {
  const { logout } = useFirebaseAuth();
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
          <TouchableOpacity
            onPress={async () => {
              await logout();
              navigation.reset({ index: 0, routes: [{ name: 'Home' as never }] });
            }}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tab.Screen
        name="TeacherDashboard"
        component={TeacherDashboardScreen}
        options={{ title: 'Dashboard', tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="TeacherStudents"
        component={TeacherStudentsScreen}
        options={{ title: 'Students', tabBarLabel: 'Students' }}
      />
      <Tab.Screen
        name="TeacherProfile"
        component={TeacherProfileScreen}
        options={{ title: 'Profile', tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  logoutBtn: { marginRight: 16 },
  logoutText: { color: colors.dangerLight, fontWeight: '600' },
});
