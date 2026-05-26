import os
import sys
import json


def send_sms_verification_code(phone_number: str, verification_code: str):
    """
    Envoie un code de vérification SMS au numéro de téléphone spécifié.
    
    Pour la Chine, nous utiliserons Alibaba Cloud SMS Service.
    """
    
    # Simuler l'envoi pour le développement
    # En production, vous devrez configurer Alibaba Cloud
    simulate_sms_send(phone_number, verification_code)


def simulate_sms_send(phone_number: str, verification_code: str):
    """
    Simulation de l'envoi SMS pour le développement.
    En production, remplacez cela par l'appel à Alibaba Cloud SMS.
    """
    print(f"[SIMULATION] Envoi du code de vérification {verification_code} au numéro {phone_number}")
    
    # Pour une vraie implémentation avec Alibaba Cloud, voir ci-dessous


def send_sms_via_alibaba_cloud(phone_number: str, verification_code: str):
    """
    Envoi SMS via Alibaba Cloud SMS Service (pour la Chine).
    
    Configuration requise :
    1. Créer un compte Alibaba Cloud
    2. Activer le service SMS (Dysmsapi)
    3. Créer une signature et un modèle de SMS
    4. Obtenir AccessKey ID et AccessKey Secret
    
    Variables d'environnement nécessaires :
    - ALIBABA_CLOUD_ACCESS_KEY_ID
    - ALIBABA_CLOUD_ACCESS_KEY_SECRET
    - ALIBABA_CLOUD_SMS_SIGN_NAME
    - ALIBABA_CLOUD_SMS_TEMPLATE_CODE
    """
    try:
        from aliyunsdkcore.client import AcsClient
        from aliyunsdkdysmsapi.request.v20170525.SendSmsRequest import SendSmsRequest
        
        access_key_id = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_ID')
        access_key_secret = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
        sign_name = os.getenv('ALIBABA_CLOUD_SMS_SIGN_NAME')
        template_code = os.getenv('ALIBABA_CLOUD_SMS_TEMPLATE_CODE')
        
        if not all([access_key_id, access_key_secret, sign_name, template_code]):
            print("Erreur : Variables d'environnement Alibaba Cloud non configurées")
            simulate_sms_send(phone_number, verification_code)
            return
        
        client = AcsClient(
            access_key_id,
            access_key_secret,
            'cn-hangzhou'  # Région pour la Chine
        )
        
        request = SendSmsRequest()
        request.set_accept_format('json')
        
        request.set_PhoneNumbers(phone_number)
        request.set_SignName(sign_name)
        request.set_TemplateCode(template_code)
        request.set_TemplateParam(json.dumps({
            'code': verification_code
        }))
        
        response = client.do_action_with_exception(request)
        response_dict = json.loads(response.decode('utf-8'))
        
        if response_dict.get('Code') == 'OK':
            print(f"SMS envoyé avec succès à {phone_number}")
        else:
            print(f"Échec de l'envoi SMS : {response_dict.get('Message')}")
            
    except ImportError:
        print("Erreur : Bibliothèque aliyun-python-sdk-dysmsapi non installée")
        simulate_sms_send(phone_number, verification_code)
    except Exception as e:
        print(f"Erreur lors de l'envoi SMS : {str(e)}")
        simulate_sms_send(phone_number, verification_code)