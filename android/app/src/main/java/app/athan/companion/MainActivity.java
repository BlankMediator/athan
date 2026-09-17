package app.athan.companion;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.app.NotificationChannel;
import android.app.NotificationManager;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AthanPrintPlugin.class);
        super.onCreate(savedInstanceState);
        NotificationChannel reminders = new NotificationChannel("athan-reminders-v1", "Prayer and reading reminders", NotificationManager.IMPORTANCE_DEFAULT);
        reminders.setDescription("Silent prayer times and daily readings");
        reminders.setSound(null, null);
        reminders.enableVibration(false);
        getSystemService(NotificationManager.class).createNotificationChannel(reminders);
    }
}
