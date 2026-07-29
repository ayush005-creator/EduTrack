from django.urls import path
from . import views

urlpatterns = [
    # Pages
    path('', views.index_view, name='index'),
    path('login/', views.login_view, name='login'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('logout/', views.logout_page_view, name='logout'),

    # Auth APIs
    path('api/signup/', views.api_signup, name='api_signup'),
    path('api/login/', views.api_login, name='api_login'),
    path('api/logout/', views.api_logout, name='api_logout'),
    path('api/me/', views.api_me, name='api_me'),
    path('api/profile/', views.api_update_profile, name='api_profile'),
    path('api/change-password/', views.api_change_password, name='api_change_password'),

    # Feature APIs
    path('api/attendance/', views.api_attendance, name='api_attendance'),
    path('api/tasks/', views.api_tasks, name='api_tasks'),
    path('api/tasks/<int:task_id>/', views.api_task_detail, name='api_task_detail'),
    path('api/notes/', views.api_notes, name='api_notes'),
    path('api/notes/<int:note_id>/', views.api_note_detail, name='api_note_detail'),
    path('api/skills/', views.api_skills, name='api_skills'),
    path('api/feedback/', views.api_feedback, name='api_feedback'),
    path('api/streaks/', views.api_streaks, name='api_streaks'),
    path('api/marks/', views.api_marks, name='api_marks'),
    path('api/clear-data/', views.api_clear_data, name='api_clear_data'),
]
