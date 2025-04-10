import traceback
from core.serializers import FHIRBundleSerializer
from core.models import Observation
from rest_framework.response import Response
from rest_framework import viewsets
from fhir.resources.bundle import Bundle
from fhir.resources.operationoutcome import OperationOutcome
from fhir.resources.resource import Resource
import humps, logging, copy, http
from rest_framework import status as http_status
from django.db.utils import IntegrityError
from django.core.exceptions import PermissionDenied, BadRequest

logger = logging.getLogger(__name__)

class FHIRBase(viewsets.GenericViewSet):

    serializer_class = FHIRBundleSerializer

    def create(self, request):
        # first validate the entire bundle
        bundle_data = copy.deepcopy(request.data)
        for entry in bundle_data['entry']:
            if 'value_attachment' not in entry['resource'] or 'data' not in entry['resource']['value_attachment'] or entry['resource']['value_attachment']['data'] is None:
                raise BadRequest("resource.valueAttachment.data must be not null.")
        fhir_bundle = Bundle.parse_obj(self.camelize(request.data))
        # then create each record
        response_entries = []
        for entry in request.data['entry']:
            if entry['resource']['resource_type'] != 'Observation':
                response_entries.append(
                    FHIRBase.bundle_create_response_entry(
                        http_status.HTTP_400_BAD_REQUEST,
                        FHIRBase.error_outcome("Only Observation resourceType supported.")
                    )
                )
            if entry['request']['method'] != 'POST':
                response_entries.append(
                    FHIRBase.bundle_create_response_entry(
                        http_status.HTTP_400_BAD_REQUEST,
                        FHIRBase.error_outcome("Only POST/Create method supported.")
                    )
                )

            try:
                observation = Observation.fhir_create(entry['resource'], request.user)
                response_entries.append(FHIRBase.bundle_create_response_entry(http_status.HTTP_201_CREATED, None, observation))
            
            except IntegrityError as e:
                response_entries.append(
                    FHIRBase.bundle_create_response_entry(http_status.HTTP_409_CONFLICT, FHIRBase.error_outcome(str(e)))
                )
            except PermissionDenied as e:
                response_entries.append(
                    FHIRBase.bundle_create_response_entry(http_status.HTTP_403_FORBIDDEN, FHIRBase.error_outcome(str(e)))
                )
            except BadRequest as e:
                response_entries.append(
                    FHIRBase.bundle_create_response_entry(http_status.HTTP_400_BAD_REQUEST, FHIRBase.error_outcome(str(e)))
                )
            except Exception as e:
                print(traceback.format_exc())
                response_entries.append(
                    FHIRBase.bundle_create_response_entry(http_status.HTTP_422_UNPROCESSABLE_ENTITY, FHIRBase.error_outcome(str(e)))
                )
        return Response(FHIRBase.bundle_batch_response(response_entries), status=http_status.HTTP_200_OK)
    
    @staticmethod
    def error_outcome(message):
        data = {
            'issue': [{
                'severity': 'error',
                'code': 'processing',
                'diagnostics': message
            }]
        }
        return OperationOutcome(**data).dict()
    
    @staticmethod
    def bundle_batch_response(entries):
        data = {
            'type': 'batch-response',
            'entry': entries
        }
        return Bundle(**data).dict()
    
    @staticmethod
    def bundle_create_response_entry(status, outcome=None, obj=None):
        entry = {
            'response': {
                'status': str(status) + ' ' + http.HTTPStatus(status).phrase
            }
        }
        if obj:
            entry['resource'] = Resource(id=obj.id)
        if outcome:
            entry['response']['outcome'] = outcome
        return entry

    @staticmethod
    def camelize(data):
        """Convert dictionary keys from snake_case to camelCase."""
        if isinstance(data, dict):
            new_dict = {}
            for key, value in data.items():
                parts = key.split("_")
                camel_key = parts[0] + "".join(word.capitalize() for word in parts[1:])
                new_dict[camel_key] = FHIRBase.camelize(value)  # Call the static method properly
            return new_dict
        elif isinstance(data, list):
            return [FHIRBase.camelize(item) for item in data]  # Call the static method properly
        else:
            return data
