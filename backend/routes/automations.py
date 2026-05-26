from fastapi import APIRouter, Depends, HTTPException
from fastapi_jwt_auth import AuthJWT
from sqlmodel import Session, select
from models.automation import Automation
from db.database import get_session
from db.models import User

automations_bp = Blueprint('automations', __name__, url_prefix='/automations')

# Default platforms data
DEFAULT_PLATFORMS = [
    {
        'id': 'chaoxing',
        'name': 'Chaoxing / 学习通',
        'login_url': 'https://passport2.chaoxing.com/login',
        'description': 'Phone, email, school account + student ID, or QR code via app',
        'logo': 'C'
    },
    {
        'id': 'icourse',
        'name': 'iCourse / 中国大学MOOC',
        'login_url': 'https://www.icourse163.org/',
        'description': 'Phone, email, iCourse account, or QR code via app',
        'logo': 'i'
    },
    {
        'id': 'xuetangx',
        'name': 'XuetangX / 学堂在线',
        'login_url': 'https://www.xuetangx.com/',
        'description': 'Phone, email, or WeChat scan. Student number login for credit courses',
        'logo': 'X'
    },
    {
        'id': 'zhihuishu',
        'name': 'Zhihuishu / 智慧树',
        'login_url': 'https://passport.zhihuishu.com/login',
        'description': 'Official login page for Zhidao platform',
        'logo': 'Z'
    }
]

@automations_bp.route('/platforms', methods=['GET'])
@jwt_required()
def get_platforms():
    """Get all platforms for the current user"""
    try:
        current_user_id = get_jwt_identity()
        db: Session = next(get_db())
        
        # Get user's custom platforms
        user_platforms = db.query(Automation).filter(
            Automation.user_id == current_user_id
        ).all()
        
        # Convert to dict and merge with default platforms
        platforms = []
        
        # Add default platforms first
        for default in DEFAULT_PLATFORMS:
            platforms.append({
                **default,
                'username': None,
                'password': None
            })
        
        # Add user's custom platforms
        for platform in user_platforms:
            platforms.append(platform.to_dict())
        
        return jsonify(platforms)
        
    except Exception as e:
        print(f"Error getting platforms: {e}")
        # Return default platforms on error
        return jsonify([{
            **default,
            'username': None,
            'password': None
        } for default in DEFAULT_PLATFORMS])

@automations_bp.route('/platforms', methods=['POST'])
@jwt_required()
def create_platform():
    """Create a new platform for the current user"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        if not data.get('name') or not data.get('login_url'):
            return jsonify({'error': 'Name and login_url are required'}), 400
        
        db: Session = next(get_db())
        
        # Create platform ID from name
        platform_id = data['name'].lower().replace(/\s+/g, '-')
        
        # Check if platform already exists for this user
        existing = db.query(Automation).filter(
            Automation.user_id == current_user_id,
            Automation.id == platform_id
        ).first()
        
        if existing:
            return jsonify({'error': 'Platform already exists'}), 400
        
        # Create new platform
        platform = Automation(
            id=platform_id,
            user_id=current_user_id,
            name=data['name'],
            login_url=data['login_url'],
            username=data.get('username'),
            password=data.get('password'),
            description=data.get('description'),
            logo=data.get('logo', data['name'][0].upper())
        )
        
        db.add(platform)
        db.commit()
        
        return jsonify(platform.to_dict()), 201
        
    except Exception as e:
        print(f"Error creating platform: {e}")
        return jsonify({'error': 'Failed to create platform'}), 500

@automations_bp.route('/platforms/<platform_id>', methods=['PUT'])
@jwt_required()
def update_platform(platform_id):
    """Update a platform for the current user"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        db: Session = next(get_db())
        
        # Find platform
        platform = db.query(Automation).filter(
            Automation.user_id == current_user_id,
            Automation.id == platform_id
        ).first()
        
        if not platform:
            return jsonify({'error': 'Platform not found'}), 404
        
        # Update fields
        if data.get('name'):
            platform.name = data['name']
        if data.get('login_url'):
            platform.login_url = data['login_url']
        if data.get('username') is not None:
            platform.username = data['username']
        if data.get('password') is not None:
            platform.password = data['password']
        if data.get('description') is not None:
            platform.description = data['description']
        if data.get('logo') is not None:
            platform.logo = data['logo']
        
        db.commit()
        
        return jsonify(platform.to_dict())
        
    except Exception as e:
        print(f"Error updating platform: {e}")
        return jsonify({'error': 'Failed to update platform'}), 500

@automations_bp.route('/platforms/<platform_id>', methods=['DELETE'])
@jwt_required()
def delete_platform(platform_id):
    """Delete a platform for the current user"""
    try:
        current_user_id = get_jwt_identity()
        
        db: Session = next(get_db())
        
        # Find platform
        platform = db.query(Automation).filter(
            Automation.user_id == current_user_id,
            Automation.id == platform_id
        ).first()
        
        if not platform:
            return jsonify({'error': 'Platform not found'}), 404
        
        db.delete(platform)
        db.commit()
        
        return jsonify({'message': 'Platform deleted successfully'})
        
    except Exception as e:
        print(f"Error deleting platform: {e}")
        return jsonify({'error': 'Failed to delete platform'}), 500
