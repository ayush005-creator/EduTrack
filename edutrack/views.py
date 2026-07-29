import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.shortcuts import render, redirect
from django.utils.decorators import method_decorator
from .models import (
    User, Attendance, SoftSkill, Task, PracticeLog,
    Feedback, UserStreak, SubjectMark
)


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def get_current_user(request):
    user_id = request.session.get('user_id')
    if not user_id:
        return None
    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return None


def login_required_api(view_func):
    def wrapped(request, *args, **kwargs):
        if not request.session.get('user_id'):
            return JsonResponse({'error': 'Not authenticated'}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapped


def json_body(request):
    try:
        return json.loads(request.body)
    except Exception:
        return {}


# ─────────────────────────────────────────────
# PAGE VIEWS
# ─────────────────────────────────────────────

def index_view(request):
    if request.session.get('user_id'):
        return redirect('/dashboard/')
    return render(request, 'edutrack/index.html')


def login_view(request):
    if request.session.get('user_id'):
        return redirect('/dashboard/')
    return render(request, 'edutrack/login.html')


def dashboard_view(request):
    if not request.session.get('user_id'):
        return redirect('/login/')
    return render(request, 'edutrack/dashboard.html')


def logout_page_view(request):
    request.session.flush()
    return redirect('/login/')


# ─────────────────────────────────────────────
# AUTH APIs
# ─────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def api_signup(request):
    data = json_body(request)

    required = ['fullname', 'email', 'password']
    for field in required:
        if not data.get(field, '').strip():
            return JsonResponse({'error': f'{field} is required'}, status=400)

    email = data['email'].strip().lower()
    if User.objects.filter(email=email).exists():
        return JsonResponse({'error': 'Email already registered'}, status=400)

    phone = data.get('phone', '').strip()
    if phone and User.objects.filter(phone=phone).exists():
        return JsonResponse({'error': 'Phone number already registered'}, status=400)

    user = User(
        full_name=data['fullname'].strip(),
        email=email,
        phone=phone,
        dob=data.get('dob') or None,
        gender=data.get('gender', ''),
        address=data.get('address', ''),
        course=data.get('course', ''),
        branch=data.get('branch', ''),
        college=data.get('college', ''),
    )
    user.set_password(data['password'])
    user.save()

    # Create default streak record
    UserStreak.objects.create(user=user)

    request.session['user_id'] = user.pk
    request.session['user_name'] = user.full_name

    return JsonResponse({
        'success': True,
        'user': {
            'id': user.pk,
            'fullname': user.full_name,
            'email': user.email,
            'phone': user.phone,
            'course': user.course,
            'branch': user.branch,
            'college': user.college,
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def api_login(request):
    data = json_body(request)
    login_id = data.get('login_id', '').strip().lower()
    password = data.get('password', '')

    if not login_id or not password:
        return JsonResponse({'error': 'Email/phone and password are required'}, status=400)

    # Try email first, then phone
    user = None
    try:
        user = User.objects.get(email=login_id)
    except User.DoesNotExist:
        try:
            user = User.objects.get(phone=login_id)
        except User.DoesNotExist:
            pass

    if not user:
        return JsonResponse({'error': 'No account found with this email / phone'}, status=401)

    if not user.check_password(password):
        return JsonResponse({'error': 'Incorrect password'}, status=401)

    request.session['user_id'] = user.pk
    request.session['user_name'] = user.full_name

    return JsonResponse({
        'success': True,
        'user': {
            'id': user.pk,
            'fullname': user.full_name,
            'email': user.email,
            'phone': user.phone,
            'course': user.course,
            'branch': user.branch,
            'college': user.college,
            'dob': str(user.dob) if user.dob else '',
            'gender': user.gender,
            'address': user.address,
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def api_logout(request):
    request.session.flush()
    return JsonResponse({'success': True})


@login_required_api
@require_http_methods(["GET"])
def api_me(request):
    user = get_current_user(request)
    return JsonResponse({
        'id': user.pk,
        'fullname': user.full_name,
        'email': user.email,
        'phone': user.phone,
        'dob': str(user.dob) if user.dob else '',
        'gender': user.gender,
        'address': user.address,
        'course': user.course,
        'branch': user.branch,
        'college': user.college,
    })


@csrf_exempt
@login_required_api
@require_http_methods(["POST"])
def api_update_profile(request):
    user = get_current_user(request)
    data = json_body(request)

    if 'fullname' in data:
        user.full_name = data['fullname'].strip()
    if 'email' in data:
        new_email = data['email'].strip().lower()
        if new_email != user.email and User.objects.filter(email=new_email).exists():
            return JsonResponse({'error': 'Email already in use'}, status=400)
        user.email = new_email
    if 'phone' in data:
        user.phone = data['phone'].strip()
    if 'dob' in data:
        user.dob = data['dob'] or None
    if 'gender' in data:
        user.gender = data['gender']
    if 'address' in data:
        user.address = data['address'].strip()
    if 'course' in data:
        user.course = data['course']
    if 'branch' in data:
        user.branch = data['branch']

    user.save()
    request.session['user_name'] = user.full_name
    return JsonResponse({'success': True, 'fullname': user.full_name})


@csrf_exempt
@login_required_api
@require_http_methods(["POST"])
def api_change_password(request):
    user = get_current_user(request)
    data = json_body(request)

    current = data.get('current_password', '')
    new_pass = data.get('new_password', '')

    if not user.check_password(current):
        return JsonResponse({'error': 'Current password is incorrect'}, status=400)
    if len(new_pass) < 6:
        return JsonResponse({'error': 'New password must be at least 6 characters'}, status=400)

    user.set_password(new_pass)
    user.save()
    return JsonResponse({'success': True})


# ─────────────────────────────────────────────
# ATTENDANCE APIs
# ─────────────────────────────────────────────

@csrf_exempt
@login_required_api
def api_attendance(request):
    user = get_current_user(request)

    if request.method == 'GET':
        records = Attendance.objects.filter(user=user)
        return JsonResponse({
            'attendance': [
                {
                    'id': r.pk,
                    'subject': r.subject,
                    'classes_held': r.classes_held,
                    'classes_attended': r.classes_attended,
                    'percentage': r.percentage,
                }
                for r in records
            ]
        })

    if request.method == 'POST':
        data = json_body(request)
        records = data.get('records', [])

        # Delete old and re-save (full replace)
        Attendance.objects.filter(user=user).delete()
        saved = []
        for rec in records:
            if not rec.get('subject', '').strip():
                continue
            a = Attendance.objects.create(
                user=user,
                subject=rec['subject'].strip(),
                classes_held=int(rec.get('classes_held', 0)),
                classes_attended=int(rec.get('classes_attended', 0)),
            )
            saved.append({
                'id': a.pk,
                'subject': a.subject,
                'classes_held': a.classes_held,
                'classes_attended': a.classes_attended,
                'percentage': a.percentage,
            })
        return JsonResponse({'success': True, 'attendance': saved})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ─────────────────────────────────────────────
# TASKS APIs
# ─────────────────────────────────────────────

@csrf_exempt
@login_required_api
def api_tasks(request):
    user = get_current_user(request)

    if request.method == 'GET':
        tasks = Task.objects.filter(user=user)
        return JsonResponse({
            'tasks': [
                {
                    'id': t.pk,
                    'title': t.title,
                    'priority': t.priority,
                    'due_date': str(t.due_date) if t.due_date else '',
                    'is_completed': t.is_completed,
                    'created_at': t.created_at.isoformat(),
                }
                for t in tasks
            ]
        })

    if request.method == 'POST':
        data = json_body(request)
        title = data.get('title', '').strip()
        if not title:
            return JsonResponse({'error': 'Title required'}, status=400)

        t = Task.objects.create(
            user=user,
            title=title,
            priority=data.get('priority', 'medium'),
            due_date=data.get('due_date') or None,
        )
        return JsonResponse({
            'success': True,
            'task': {
                'id': t.pk,
                'title': t.title,
                'priority': t.priority,
                'due_date': str(t.due_date) if t.due_date else '',
                'is_completed': t.is_completed,
                'created_at': t.created_at.isoformat(),
            }
        })

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
@login_required_api
def api_task_detail(request, task_id):
    user = get_current_user(request)
    try:
        task = Task.objects.get(pk=task_id, user=user)
    except Task.DoesNotExist:
        return JsonResponse({'error': 'Task not found'}, status=404)

    if request.method == 'PATCH':
        data = json_body(request)
        if 'is_completed' in data:
            task.is_completed = data['is_completed']
        if 'title' in data:
            task.title = data['title'].strip()
        if 'priority' in data:
            task.priority = data['priority']
        if 'due_date' in data:
            task.due_date = data['due_date'] or None
        task.save()
        return JsonResponse({'success': True, 'is_completed': task.is_completed})

    if request.method == 'DELETE':
        task.delete()
        return JsonResponse({'success': True})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ─────────────────────────────────────────────
# PRACTICE LOG (NOTES) APIs
# ─────────────────────────────────────────────

@csrf_exempt
@login_required_api
def api_notes(request):
    user = get_current_user(request)

    if request.method == 'GET':
        notes = PracticeLog.objects.filter(user=user)
        return JsonResponse({
            'notes': [
                {
                    'id': n.pk,
                    'title': n.title,
                    'category': n.category,
                    'content': n.content,
                    'created_at': n.created_at.isoformat(),
                }
                for n in notes
            ]
        })

    if request.method == 'POST':
        data = json_body(request)
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        if not title or not content:
            return JsonResponse({'error': 'Title and content required'}, status=400)

        n = PracticeLog.objects.create(
            user=user,
            title=title,
            category=data.get('category', '').strip(),
            content=content,
        )
        return JsonResponse({
            'success': True,
            'note': {
                'id': n.pk,
                'title': n.title,
                'category': n.category,
                'content': n.content,
                'created_at': n.created_at.isoformat(),
            }
        })

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
@login_required_api
def api_note_detail(request, note_id):
    user = get_current_user(request)
    try:
        note = PracticeLog.objects.get(pk=note_id, user=user)
    except PracticeLog.DoesNotExist:
        return JsonResponse({'error': 'Note not found'}, status=404)

    if request.method == 'DELETE':
        note.delete()
        return JsonResponse({'success': True})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ─────────────────────────────────────────────
# SOFT SKILLS APIs
# ─────────────────────────────────────────────

@csrf_exempt
@login_required_api
def api_skills(request):
    user = get_current_user(request)

    if request.method == 'GET':
        try:
            skills = user.soft_skills
            return JsonResponse({
                'skills': {
                    'communication': skills.communication,
                    'teamwork': skills.teamwork,
                    'time_management': skills.time_management,
                    'problem_solving': skills.problem_solving,
                }
            })
        except SoftSkill.DoesNotExist:
            return JsonResponse({'skills': {
                'communication': 0, 'teamwork': 0,
                'time_management': 0, 'problem_solving': 0
            }})

    if request.method == 'POST':
        data = json_body(request)
        skills_data = data.get('skills', {})
        skills, _ = SoftSkill.objects.get_or_create(user=user)
        skills.communication = int(skills_data.get('communication', 0))
        skills.teamwork = int(skills_data.get('teamwork', 0))
        skills.time_management = int(skills_data.get('time_management', 0))
        skills.problem_solving = int(skills_data.get('problem_solving', 0))
        skills.save()
        return JsonResponse({'success': True})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ─────────────────────────────────────────────
# FEEDBACK APIs
# ─────────────────────────────────────────────

@csrf_exempt
@login_required_api
def api_feedback(request):
    user = get_current_user(request)

    if request.method == 'GET':
        feedbacks = Feedback.objects.filter(user=user)
        return JsonResponse({
            'feedbacks': [
                {
                    'id': f.pk,
                    'rating': f.rating,
                    'mood': f.mood,
                    'category': f.category,
                    'subject': f.subject,
                    'message': f.message,
                    'created_at': f.created_at.isoformat(),
                }
                for f in feedbacks
            ]
        })

    if request.method == 'POST':
        data = json_body(request)
        message = data.get('message', '').strip()
        if not message:
            return JsonResponse({'error': 'Message required'}, status=400)

        f = Feedback.objects.create(
            user=user,
            rating=int(data.get('rating', 0)),
            mood=data.get('mood', ''),
            category=data.get('category', 'general'),
            subject=data.get('subject', '').strip(),
            message=message,
        )
        return JsonResponse({
            'success': True,
            'feedback': {
                'id': f.pk,
                'rating': f.rating,
                'mood': f.mood,
                'category': f.category,
                'subject': f.subject,
                'message': f.message,
                'created_at': f.created_at.isoformat(),
            }
        })

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ─────────────────────────────────────────────
# STREAKS APIs
# ─────────────────────────────────────────────

@csrf_exempt
@login_required_api
def api_streaks(request):
    user = get_current_user(request)
    streak, _ = UserStreak.objects.get_or_create(user=user)

    if request.method == 'GET':
        return JsonResponse({
            'streak': {
                'count': streak.current_streak,
                'best': streak.best_streak,
                'logged': streak.logged_dates,
                'badges': streak.badges,
            }
        })

    if request.method == 'POST':
        data = json_body(request)
        streak_data = data.get('streak', {})
        streak.current_streak = int(streak_data.get('count', 0))
        streak.best_streak = int(streak_data.get('best', 0))
        streak.logged_dates = streak_data.get('logged', [])
        streak.badges = streak_data.get('badges', [])
        streak.save()
        return JsonResponse({'success': True})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ─────────────────────────────────────────────
# MARKS APIs
# ─────────────────────────────────────────────

@csrf_exempt
@login_required_api
def api_marks(request):
    user = get_current_user(request)

    if request.method == 'GET':
        marks = SubjectMark.objects.filter(user=user)
        return JsonResponse({
            'marks': [
                {
                    'id': m.pk,
                    'subject': m.subject,
                    'max_marks': m.max_marks,
                    'obtained_marks': m.obtained_marks,
                    'credits': m.credits,
                }
                for m in marks
            ]
        })

    if request.method == 'POST':
        data = json_body(request)
        records = data.get('records', [])
        SubjectMark.objects.filter(user=user).delete()
        saved = []
        for rec in records:
            if not rec.get('subject', '').strip():
                continue
            m = SubjectMark.objects.create(
                user=user,
                subject=rec['subject'].strip(),
                max_marks=float(rec.get('max_marks', 100)),
                obtained_marks=float(rec.get('obtained_marks', 0)),
                credits=float(rec.get('credits', 3)),
            )
            saved.append({
                'id': m.pk, 'subject': m.subject,
                'max_marks': m.max_marks,
                'obtained_marks': m.obtained_marks,
                'credits': m.credits,
            })
        return JsonResponse({'success': True, 'marks': saved})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ─────────────────────────────────────────────
# CLEAR ALL DATA
# ─────────────────────────────────────────────

@csrf_exempt
@login_required_api
@require_http_methods(["POST"])
def api_clear_data(request):
    user = get_current_user(request)
    Task.objects.filter(user=user).delete()
    PracticeLog.objects.filter(user=user).delete()
    Attendance.objects.filter(user=user).delete()
    SubjectMark.objects.filter(user=user).delete()
    Feedback.objects.filter(user=user).delete()
    try:
        user.soft_skills.delete()
    except SoftSkill.DoesNotExist:
        pass
    try:
        streak = user.streak
        streak.current_streak = 0
        streak.best_streak = 0
        streak.logged_dates = []
        streak.badges = []
        streak.save()
    except UserStreak.DoesNotExist:
        pass
    request.session.flush()
    return JsonResponse({'success': True})
