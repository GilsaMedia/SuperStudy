import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import StudentDashboardScreen from '../screens/student/StudentDashboardScreen';
import StudentFindTeachersScreen from '../screens/student/StudentFindTeachersScreen';
import StudentMyTeachersScreen from '../screens/student/StudentMyTeachersScreen';
import StudyHelperScreen from '../screens/StudyHelperScreen';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

export default function StudentTabs() {
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
        name="StudentDashboard"
        component={StudentDashboardScreen}
        options={{ title: 'Dashboard', tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="FindTeachers"
        component={StudentFindTeachersScreen}
        options={{ title: 'Find Teachers', tabBarLabel: 'Find' }}
      />
      <Tab.Screen
        name="MyTeachers"
        component={StudentMyTeachersScreen}
        options={{ title: 'My Teachers', tabBarLabel: 'My Teachers' }}
      />
      <Tab.Screen
        name="StudyHelper"
        component={StudyHelperScreen}
        options={{ title: 'Study Helper', tabBarLabel: 'Helper' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  logoutBtn: { marginRight: 16 },
  logoutText: { color: colors.dangerLight, fontWeight: '600' },
});
