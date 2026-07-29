from django.db import models
from django.contrib.auth.hashers import make_password, check_password as django_check_password


class User(models.Model):
    full_name = models.CharField(max_length=200)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    password = models.CharField(max_length=256)
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    course = models.CharField(max_length=50, blank=True)
    branch = models.CharField(max_length=100, blank=True)
    college = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        return django_check_password(raw_password, self.password)

    def __str__(self):
        return f"{self.full_name} ({self.email})"

    class Meta:
        db_table = 'edutrack_users'


class Attendance(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_records')
    subject = models.CharField(max_length=200)
    classes_held = models.IntegerField(default=0)
    classes_attended = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def percentage(self):
        if self.classes_held == 0:
            return 0
        return round((self.classes_attended / self.classes_held) * 100, 1)

    def __str__(self):
        return f"{self.user.full_name} – {self.subject}"

    class Meta:
        db_table = 'edutrack_attendance'
        unique_together = ('user', 'subject')


class SoftSkill(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='soft_skills')
    communication = models.IntegerField(default=0)
    teamwork = models.IntegerField(default=0)
    time_management = models.IntegerField(default=0)
    problem_solving = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.full_name} – Skills"

    class Meta:
        db_table = 'edutrack_soft_skills'


class Task(models.Model):
    PRIORITY_CHOICES = [('high', 'High'), ('medium', 'Medium'), ('low', 'Low')]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=300)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    due_date = models.DateField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.full_name} – {self.title}"

    class Meta:
        db_table = 'edutrack_tasks'
        ordering = ['-created_at']


class PracticeLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='practice_logs')
    title = models.CharField(max_length=300)
    category = models.CharField(max_length=100, blank=True)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.full_name} – {self.title}"

    class Meta:
        db_table = 'edutrack_practice_logs'
        ordering = ['-created_at']


class Feedback(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedbacks')
    rating = models.IntegerField(default=0)
    mood = models.CharField(max_length=30, blank=True)
    category = models.CharField(max_length=50, default='general')
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.full_name} – {self.rating}★"

    class Meta:
        db_table = 'edutrack_feedback'
        ordering = ['-created_at']


class UserStreak(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='streak')
    current_streak = models.IntegerField(default=0)
    best_streak = models.IntegerField(default=0)
    logged_dates = models.JSONField(default=list)
    badges = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'edutrack_streaks'


class SubjectMark(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='marks')
    subject = models.CharField(max_length=200)
    max_marks = models.FloatField(default=100)
    obtained_marks = models.FloatField(default=0)
    credits = models.FloatField(default=3)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'edutrack_marks'
        unique_together = ('user', 'subject')
