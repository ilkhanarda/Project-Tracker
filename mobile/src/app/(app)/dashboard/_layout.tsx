import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function DashboardLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen
                    name="account"
                    options={{
                        presentation: 'formSheet',
                        sheetAllowedDetents: [0.35, 0.75],
                        sheetInitialDetentIndex: 0,
                        sheetGrabberVisible: true,
                        sheetCornerRadius: 55,
                        sheetLargestUndimmedDetentIndex: 0,
                        sheetExpandsWhenScrolledToEdge: true,
                    }}
                />
            </Stack>
        </GestureHandlerRootView>
    );
}
